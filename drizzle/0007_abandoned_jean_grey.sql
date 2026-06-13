CREATE TABLE `time_blocks` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`date` varchar(10) NOT NULL,
	`startMin` int NOT NULL,
	`endMin` int NOT NULL,
	`categoryId` varchar(64),
	`taskType` varchar(32),
	`recurFreq` enum('daily','weekly'),
	`recurEndDate` varchar(10),
	`createdAt` varchar(10) NOT NULL,
	CONSTRAINT `time_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurFreq` enum('daily','weekly');--> statement-breakpoint
ALTER TABLE `tasks` ADD `recurEndDate` varchar(10);