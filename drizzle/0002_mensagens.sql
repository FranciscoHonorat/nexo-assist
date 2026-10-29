CREATE TYPE "public"."autor_da_mensagem" AS ENUM('funcionario', 'agent');--> statement-breakpoint
CREATE TABLE "mensagens" (
	"id" serial PRIMARY KEY NOT NULL,
	"dono" text NOT NULL,
	"autor" "autor_da_mensagem" NOT NULL,
	"texto" text NOT NULL,
	"enviada_em" timestamp with time zone NOT NULL,
	"registro" jsonb,
	CONSTRAINT "so_o_agent_tem_registro" CHECK (("mensagens"."autor" = 'agent') = ("mensagens"."registro" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_dono_conversas_dono_fk" FOREIGN KEY ("dono") REFERENCES "public"."conversas"("dono") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mensagens_por_dono" ON "mensagens" USING btree ("dono","id");