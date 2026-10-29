CREATE TYPE "public"."motivo_de_transferencia" AS ENUM('pedido_do_funcionario', 'caso_critico', 'chamado_vencido', 'baixa_confianca');--> statement-breakpoint
ALTER TABLE "conversas" ADD COLUMN "motivo_da_transferencia" "motivo_de_transferencia";--> statement-breakpoint
ALTER TABLE "conversas" ADD COLUMN "resumo_da_transferencia" text;--> statement-breakpoint
ALTER TABLE "conversas" ADD COLUMN "transferencia_pedida_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversas" ADD COLUMN "analista" text;--> statement-breakpoint
ALTER TABLE "conversas" ADD COLUMN "assumida_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "transferencia_completa_fora_do_agent" CHECK (num_nonnulls("conversas"."motivo_da_transferencia", "conversas"."resumo_da_transferencia", "conversas"."transferencia_pedida_em")
        = CASE WHEN "conversas"."controle" = 'agent' THEN 0 ELSE 3 END);--> statement-breakpoint
ALTER TABLE "conversas" ADD CONSTRAINT "analista_so_quando_assumida" CHECK (num_nonnulls("conversas"."analista", "conversas"."assumida_em")
        = CASE WHEN "conversas"."controle" = 'analista' THEN 2 ELSE 0 END);