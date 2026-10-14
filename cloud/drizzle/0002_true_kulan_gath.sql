CREATE TABLE `wholesaler_verifications` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`info` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
