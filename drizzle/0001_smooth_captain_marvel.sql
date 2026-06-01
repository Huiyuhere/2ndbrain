ALTER TABLE `categories` MODIFY COLUMN `keywords` json;--> statement-breakpoint
ALTER TABLE `evening_entries` MODIFY COLUMN `highlights` json;--> statement-breakpoint
ALTER TABLE `reflections` MODIFY COLUMN `answers` json;--> statement-breakpoint
ALTER TABLE `roadmap_projects` MODIFY COLUMN `milestones` json;--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `subtasks` json;--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `links` json;