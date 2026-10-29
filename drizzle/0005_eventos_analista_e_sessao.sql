ALTER TABLE "mensagens" DROP CONSTRAINT "so_o_agent_tem_registro";--> statement-breakpoint
ALTER TYPE "public"."autor_da_mensagem" RENAME TO "autor_da_mensagem_antigo";--> statement-breakpoint
CREATE TYPE "public"."autor_da_mensagem" AS ENUM('funcionario', 'agent', 'analista', 'sistema');--> statement-breakpoint
ALTER TABLE "mensagens" ALTER COLUMN "autor" TYPE "public"."autor_da_mensagem" USING "autor"::text::"public"."autor_da_mensagem";--> statement-breakpoint
DROP TYPE "public"."autor_da_mensagem_antigo";--> statement-breakpoint
ALTER TABLE "mensagens" ADD CONSTRAINT "so_o_agent_tem_registro" CHECK (("mensagens"."autor" = 'agent') = ("mensagens"."registro" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "mensagens" ALTER COLUMN "texto" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversas" ADD COLUMN "sessao_desde" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mensagens" ADD COLUMN "evento" jsonb;--> statement-breakpoint
ALTER TABLE "mensagens" ADD COLUMN "analista" text;--> statement-breakpoint
ALTER TABLE "mensagens" ADD CONSTRAINT "so_a_mensagem_do_analista_tem_analista" CHECK (("mensagens"."autor" = 'analista') = ("mensagens"."analista" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "mensagens" ADD CONSTRAINT "so_o_sistema_tem_evento_e_nao_tem_texto" CHECK (("mensagens"."autor" = 'sistema') = ("mensagens"."evento" IS NOT NULL)
        AND ("mensagens"."autor" = 'sistema') = ("mensagens"."texto" IS NULL));