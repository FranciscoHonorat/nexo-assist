CREATE TYPE "public"."controle_da_conversa" AS ENUM('agent', 'aguardando', 'analista');--> statement-breakpoint
CREATE TABLE "conversas" (
	"dono" text PRIMARY KEY NOT NULL,
	"controle" "controle_da_conversa" NOT NULL,
	CONSTRAINT "dono_da_conversa_corporativo" CHECK ("conversas"."dono" ~ '^[a-z0-9._%+-]+@nexo\.com$')
);
