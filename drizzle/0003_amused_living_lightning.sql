CREATE TABLE `project_milestones` (
	`id` varchar(64) NOT NULL,
	`projectId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`date` varchar(10) NOT NULL,
	`reached` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_tasks` (
	`id` varchar(64) NOT NULL,
	`projectId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`startDate` varchar(10) NOT NULL,
	`dueDate` varchar(10) NOT NULL,
	`status` enum('todo','in_progress','done') NOT NULL DEFAULT 'todo',
	`boardTaskId` varchar(64),
	`dependsOn` json,
	`color` varchar(16),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`emoji` varchar(8) DEFAULT '📁',
	`color` varchar(16) DEFAULT '#2E86C1',
	`startDate` varchar(10) NOT NULL,
	`endDate` varchar(10) NOT NULL,
	`status` enum('active','completed','archived') NOT NULL DEFAULT 'active',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
