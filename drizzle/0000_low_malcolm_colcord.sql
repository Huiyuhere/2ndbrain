CREATE TABLE `categories` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`emoji` varchar(10) NOT NULL,
	`bgColor` varchar(20) NOT NULL,
	`textColor` varchar(20) NOT NULL,
	`keywords` json NOT NULL DEFAULT ('[]'),
	`sortOrder` int DEFAULT 0,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evening_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`location` varchar(255),
	`title` varchar(255),
	`rating` int DEFAULT 5,
	`highlights` json DEFAULT ('[]'),
	`freeWrite` text,
	`photoUrl` text,
	CONSTRAINT `evening_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`title` text NOT NULL,
	`categoryId` varchar(64) NOT NULL DEFAULT 'work',
	`progress` int DEFAULT 0,
	`current` varchar(100),
	`target` varchar(100),
	`dueDate` varchar(10),
	`done` boolean DEFAULT false,
	`sortOrder` int DEFAULT 0,
	CONSTRAINT `goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `habit_completions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`habitId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	CONSTRAINT `habit_completions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `habits` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`emoji` varchar(10) NOT NULL,
	`sortOrder` int DEFAULT 0,
	CONSTRAINT `habits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mood_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`mood` float NOT NULL DEFAULT 3,
	`sleep` float NOT NULL DEFAULT 7,
	`intention` text,
	`focus` text,
	CONSTRAINT `mood_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`type` enum('weekly','monthly','quarterly') NOT NULL,
	`date` varchar(10) NOT NULL,
	`answers` json NOT NULL DEFAULT ('{}'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reflections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roadmap_projects` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`emoji` varchar(10) NOT NULL,
	`color` varchar(20) NOT NULL,
	`startMonth` int NOT NULL DEFAULT 0,
	`endMonth` int NOT NULL DEFAULT 11,
	`progress` int DEFAULT 0,
	`milestones` json DEFAULT ('[]'),
	`goalType` enum('numerical','milestone') DEFAULT 'milestone',
	`targetValue` int,
	`currentValue` int,
	`sortOrder` int DEFAULT 0,
	CONSTRAINT `roadmap_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`title` text NOT NULL,
	`categoryId` varchar(64) NOT NULL DEFAULT 'work',
	`column` enum('ideas','future','week','today','done') NOT NULL DEFAULT 'ideas',
	`duration` varchar(20),
	`scheduledTime` varchar(10),
	`scheduledDate` varchar(10),
	`subtasks` json DEFAULT ('[]'),
	`links` json DEFAULT ('[]'),
	`notes` text,
	`createdAt` varchar(10) NOT NULL,
	`completedAt` varchar(10),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255),
	`bio` text,
	`avatarUrl` text,
	`avatarKey` text,
	`focusMode` enum('life','work','personal') NOT NULL DEFAULT 'life',
	`monthlyIntention` text,
	`quarterlyGoalText` text,
	`quarterlyGoalProgress` int DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
