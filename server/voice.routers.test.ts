/**
 * Tests for voice.transcribeAndClean tRPC procedure
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock voiceTranscription and llm modules
vi.mock('./_core/voiceTranscription', () => ({
  transcribeAudio: vi.fn(),
}));
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn(),
}));
// Mock db to prevent real DB connections
vi.mock('./db', () => ({
  getDb: vi.fn(),
}));

import { transcribeAudio } from './_core/voiceTranscription';
import { invokeLLM } from './_core/llm';
import { appRouter } from './routers';

// workspaceProcedure is public in this app — no auth needed
const ctx = { workspaceOwnerId: 1, user: null } as never;
const caller = appRouter.createCaller(ctx);

const mockTranscribeAudio = vi.mocked(transcribeAudio);
const mockInvokeLLM = vi.mocked(invokeLLM);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('voice.transcribeAndClean', () => {
  it('returns cleaned text when transcription and LLM both succeed', async () => {
    mockTranscribeAudio.mockResolvedValueOnce({
      text: 'Um, so like, I want to, you know, finish the project today.',
      language: 'en',
      segments: [],
      duration: 3.5,
      task: 'transcribe',
    } as never);

    mockInvokeLLM.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'I want to finish the project today.',
          },
        },
      ],
    } as never);

    const result = await caller.voice.transcribeAndClean({
      audioUrl: 'https://storage.example.com/voice/test.webm',
      fieldHint: 'morning intention',
    });

    expect(result.rawText).toBe('Um, so like, I want to, you know, finish the project today.');
    expect(result.cleanedText).toBe('I want to finish the project today.');
    expect(mockTranscribeAudio).toHaveBeenCalledWith({
      audioUrl: 'https://storage.example.com/voice/test.webm',
      language: 'en',
      prompt: 'Journal entry for: morning intention',
    });
  });

  it('falls back to raw text when LLM cleanup fails', async () => {
    mockTranscribeAudio.mockResolvedValueOnce({
      text: 'Um, basically I learned a lot.',
      language: 'en',
      segments: [],
      duration: 2.0,
      task: 'transcribe',
    } as never);

    mockInvokeLLM.mockRejectedValueOnce(new Error('LLM timeout'));

    const result = await caller.voice.transcribeAndClean({
      audioUrl: 'https://storage.example.com/voice/test2.webm',
    });

    expect(result.rawText).toBe('Um, basically I learned a lot.');
    // Should fall back to raw text, not throw
    expect(result.cleanedText).toBe('Um, basically I learned a lot.');
  });

  it('returns empty strings when transcription produces no text', async () => {
    mockTranscribeAudio.mockResolvedValueOnce({
      text: '',
      language: 'en',
      segments: [],
      duration: 0.5,
      task: 'transcribe',
    } as never);

    const result = await caller.voice.transcribeAndClean({
      audioUrl: 'https://storage.example.com/voice/empty.webm',
    });

    expect(result.rawText).toBe('');
    expect(result.cleanedText).toBe('');
    // LLM should NOT be called for empty transcription
    expect(mockInvokeLLM).not.toHaveBeenCalled();
  });

  it('throws when transcription returns an error', async () => {
    mockTranscribeAudio.mockResolvedValueOnce({
      error: 'Audio file too large',
      code: 'SIZE_EXCEEDED',
    } as never);

    await expect(
      caller.voice.transcribeAndClean({
        audioUrl: 'https://storage.example.com/voice/huge.webm',
      })
    ).rejects.toThrow('Transcription failed: Audio file too large');
  });

  it('uses default prompt when no fieldHint is provided', async () => {
    mockTranscribeAudio.mockResolvedValueOnce({
      text: 'Had a good day.',
      language: 'en',
      segments: [],
      duration: 1.5,
      task: 'transcribe',
    } as never);
    mockInvokeLLM.mockResolvedValueOnce({
      choices: [{ message: { content: 'Had a good day.' } }],
    } as never);

    await caller.voice.transcribeAndClean({
      audioUrl: 'https://storage.example.com/voice/test3.webm',
    });

    expect(mockTranscribeAudio).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'Personal journal entry' })
    );
  });
});

describe('voice.parseEveningDump', () => {
  it('parses a brain dump into title, highlights, and freeWrite', async () => {
    mockTranscribeAudio.mockResolvedValueOnce({
      text: 'Today was great. I finished the project. But I was late to the meeting.',
      language: 'en',
      segments: [],
      duration: 5.0,
      task: 'transcribe',
    } as never);

    mockInvokeLLM.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            title: 'A day of contrasts',
            highlights: [
              { type: '+', text: 'Finished the project' },
              { type: '-', text: 'Was late to the meeting' },
            ],
            freeWrite: '',
          }),
        },
      }],
    } as never);

    const result = await caller.voice.parseEveningDump({
      audioUrl: 'https://storage.example.com/voice/dump.webm',
    });

    expect(result.title).toBe('A day of contrasts');
    expect(result.highlights).toHaveLength(2);
    expect(result.highlights[0]).toEqual({ type: '+', text: 'Finished the project' });
    expect(result.highlights[1]).toEqual({ type: '-', text: 'Was late to the meeting' });
  });

  it('falls back to freeWrite when LLM parsing fails', async () => {
    mockTranscribeAudio.mockResolvedValueOnce({
      text: 'Had a busy day.',
      language: 'en',
      segments: [],
      duration: 1.5,
      task: 'transcribe',
    } as never);

    mockInvokeLLM.mockRejectedValueOnce(new Error('LLM error'));

    const result = await caller.voice.parseEveningDump({
      audioUrl: 'https://storage.example.com/voice/dump2.webm',
    });

    expect(result.rawText).toBe('Had a busy day.');
    expect(result.freeWrite).toBe('Had a busy day.');
    expect(result.highlights).toEqual([]);
  });

  it('returns empty result for silent recording', async () => {
    mockTranscribeAudio.mockResolvedValueOnce({
      text: '',
      language: 'en',
      segments: [],
      duration: 0.5,
      task: 'transcribe',
    } as never);

    const result = await caller.voice.parseEveningDump({
      audioUrl: 'https://storage.example.com/voice/silent.webm',
    });

    expect(result.rawText).toBe('');
    expect(result.title).toBe('');
    expect(result.highlights).toEqual([]);
    expect(result.freeWrite).toBe('');
    expect(mockInvokeLLM).not.toHaveBeenCalled();
  });
});
