CREATE TABLE `assignment_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`studentId` int NOT NULL,
	`done` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	CONSTRAINT `assignment_statuses_id` PRIMARY KEY(`id`),
	CONSTRAINT `assignment_status_unique` UNIQUE(`assignmentId`,`studentId`)
);
--> statement-breakpoint
CREATE TABLE `assignment_students` (
	`assignmentId` int NOT NULL,
	`studentId` int NOT NULL,
	CONSTRAINT `assignment_students_assignmentId_studentId_pk` PRIMARY KEY(`assignmentId`,`studentId`)
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subject` varchar(120) NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text,
	`dueDate` timestamp NOT NULL,
	`createdBy` int NOT NULL,
	`classId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `class_students` (
	`classId` int NOT NULL,
	`studentId` int NOT NULL,
	`enrolledAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `class_students_classId_studentId_pk` PRIMARY KEY(`classId`,`studentId`)
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`staffId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `personal_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`subject` varchar(120) NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text,
	`dueDate` timestamp NOT NULL,
	`done` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `personal_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`role` enum('staff','student') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `assignment_statuses` ADD CONSTRAINT `assignment_statuses_assignmentId_assignments_id_fk` FOREIGN KEY (`assignmentId`) REFERENCES `assignments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignment_statuses` ADD CONSTRAINT `assignment_statuses_studentId_users_id_fk` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignment_students` ADD CONSTRAINT `assignment_students_assignmentId_assignments_id_fk` FOREIGN KEY (`assignmentId`) REFERENCES `assignments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignment_students` ADD CONSTRAINT `assignment_students_studentId_users_id_fk` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_classId_classes_id_fk` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `class_students` ADD CONSTRAINT `class_students_classId_classes_id_fk` FOREIGN KEY (`classId`) REFERENCES `classes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `class_students` ADD CONSTRAINT `class_students_studentId_users_id_fk` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `classes` ADD CONSTRAINT `classes_staffId_users_id_fk` FOREIGN KEY (`staffId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personal_assignments` ADD CONSTRAINT `personal_assignments_studentId_users_id_fk` FOREIGN KEY (`studentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;