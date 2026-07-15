CREATE TABLE `google_calendar_events` (
	`id` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`googleCalendarId` varchar(256) NOT NULL,
	`googleEventId` varchar(128) NOT NULL,
	`title` varchar(512) NOT NULL,
	`date` varchar(10) NOT NULL,
	`startMin` int,
	`endMin` int,
	`endDate` varchar(10),
	`description` text,
	`colorHex` varchar(7),
	`calendarName` varchar(256),
	`syncedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_calendar_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `google_sync_calendars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`calendarId` varchar(256) NOT NULL,
	`calendarName` varchar(256) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`colorHex` varchar(7),
	CONSTRAINT `google_sync_calendars_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `google_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text NOT NULL,
	`expiresAt` bigint NOT NULL,
	`scope` text,
	`email` varchar(320),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `google_tokens_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `googleEventId` varchar(128);--> statement-breakpoint
ALTER TABLE `time_blocks` ADD `googleEventId` varchar(128);