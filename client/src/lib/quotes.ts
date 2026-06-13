// Curated quote-of-the-day list. One quote is chosen deterministically per
// calendar day, so the same quote shows all day and rotates the next day.

export type Quote = { text: string; author: string };

export const QUOTES: Quote[] = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "What gets measured gets managed.", author: "Peter Drucker" },
  { text: "Focus is about saying no.", author: "Steve Jobs" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "If you spend too long thinking about a thing, you'll never get it done.", author: "Bruce Lee" },
  { text: "Amateurs sit and wait for inspiration; the rest of us just get up and go to work.", author: "Stephen King" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Either you run the day or the day runs you.", author: "Jim Rohn" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "Motivation gets you going, but discipline keeps you growing.", author: "John C. Maxwell" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupery" },
  { text: "Slow is smooth, and smooth is fast.", author: "Navy SEALs" },
  { text: "What you do every day matters more than what you do once in a while.", author: "Gretchen Rubin" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "Do the hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "If it matters, do it today.", author: "Unknown" },
  { text: "The man who moves a mountain begins by carrying away small stones.", author: "Confucius" },
  { text: "Clarity precedes mastery.", author: "Robin Sharma" },
  { text: "You can't build a reputation on what you are going to do.", author: "Henry Ford" },
];

// Days since Unix epoch in local time -> stable index for "today".
export function getQuoteOfDay(date: Date = new Date()): Quote {
  const dayNumber = Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000
  );
  const idx = ((dayNumber % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[idx];
}
