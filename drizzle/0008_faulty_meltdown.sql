CREATE TABLE `reflection_insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`period` enum('weekly','monthly','quarterly') NOT NULL,
	`periodKey` varchar(16) NOT NULL,
	`content` text,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reflection_insights_id` PRIMARY KEY(`id`)
);
