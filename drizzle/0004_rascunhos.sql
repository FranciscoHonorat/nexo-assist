CREATE TYPE "public"."status_do_rascunho" AS ENUM('pendente', 'confirmado', 'descartado');--> statement-breakpoint
CREATE TABLE "rascunhos" (
	"id" text PRIMARY KEY NOT NULL,
	"dono" text NOT NULL,
	"conteudo" jsonb NOT NULL,
	"status" "status_do_rascunho" NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	"resolvido_em" timestamp with time zone,
	CONSTRAINT "resolvido_so_fora_do_pendente" CHECK (("rascunhos"."status" = 'pendente') = ("rascunhos"."resolvido_em" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "rascunhos" ADD CONSTRAINT "rascunhos_dono_conversas_dono_fk" FOREIGN KEY ("dono") REFERENCES "public"."conversas"("dono") ON DELETE no action ON UPDATE no action;