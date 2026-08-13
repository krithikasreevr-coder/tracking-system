CREATE TABLE `pomodoro_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`assignmentId` int,
	`durationMinutes` int NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pomodoro_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminder_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`createdBy` int NOT NULL,
	`cron` varchar(64) NOT NULL DEFAULT '0 0 * * * *',
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminder_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_preferences` (
	`studentId` int NOT NULL,
	`reminderOptIn` boolean NOT NULL DEFAULT true,
	`reminderLeadHours` int NOT NULL DEFAULT 24,
	`focusMinutes` int NOT NULL DEFAULT 25,
	`shortBreakMinutes` int NOT NULL DEFAULT 5,
	`longBreakMinutes` int NOT NULL DEFAULT 15,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_preferences_studentId` PRIMARY KEY(`studentId`)
);
--> statement-breakpoint
ALTER TABLE `assignment_statuses` ADD `dueSoonNotifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `assignment_statuses` ADD `overdueNotifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `assignments` ADD `priority` enum('low','medium','high') DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `personal_assignments` ADD `priority` enum('low','medium','high') DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `pomodoro_sessions` ADD CONSTRAINT `pomodoro_sessions_studentId_users_id_fk` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pomodoro_sessions` ADD CONSTRAINT `pomodoro_sessions_assignmentId_assignments_id_fk` FOREIGN KEY (`assignmentId`) REFERENCES `assignments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminder_schedules` ADD CONSTRAINT `reminder_schedules_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_preferences` ADD CONSTRAINT `student_preferences_studentId_users_id_fk` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;