CREATE TABLE "games" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"currentPlayer" varchar(8) NOT NULL,
	"winner" varchar(8),
	"board" text
);
