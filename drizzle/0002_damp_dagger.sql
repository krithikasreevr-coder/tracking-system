ALTER TABLE `reminder_schedules` DROP FOREIGN KEY `reminder_schedules_createdBy_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `reminder_schedules` DROP FOREIGN KEY `reminder_schedules_createdBy_users_id_fk`;--> statement-breakpoint
ALTER TABLE `reminder_schedules` MODIFY COLUMN `createdBy` int;--> statement-breakpoint
ALTER TABLE `reminder_schedules` ADD CONSTRAINT `reminder_schedules_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
