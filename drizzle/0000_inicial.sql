CREATE TYPE "public"."afetados" AS ENUM('so_eu', 'minha_equipe', 'empresa');--> statement-breakpoint
CREATE TYPE "public"."categoria" AS ENUM('acesso', 'rede_e_vpn', 'hardware', 'software', 'email', 'outros');--> statement-breakpoint
CREATE TYPE "public"."prioridade" AS ENUM('critica', 'alta', 'media', 'baixa');--> statement-breakpoint
CREATE TYPE "public"."status_do_chamado" AS ENUM('aberto', 'aguardando_analista', 'aprovado', 'resolvido');--> statement-breakpoint
CREATE TYPE "public"."tipo_do_chamado" AS ENUM('incidente', 'requisicao');--> statement-breakpoint
CREATE SEQUENCE "public"."numero_de_incidente" INCREMENT BY 1 MINVALUE 1 MAXVALUE 999999999 START WITH 30000 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "public"."numero_de_requisicao" INCREMENT BY 1 MINVALUE 1 MAXVALUE 999999999 START WITH 30000 CACHE 1;--> statement-breakpoint
CREATE TABLE "chamados" (
	"id" text PRIMARY KEY NOT NULL,
	"dono" text NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text NOT NULL,
	"tipo" "tipo_do_chamado" NOT NULL,
	"categoria" "categoria" NOT NULL,
	"prioridade" "prioridade" NOT NULL,
	"afetados" "afetados" NOT NULL,
	"status" "status_do_chamado" NOT NULL,
	"criado_em" timestamp with time zone NOT NULL,
	"atualizado_em" timestamp with time zone NOT NULL,
	"rascunho_id" text,
	CONSTRAINT "chamados_rascunho_id_unique" UNIQUE("rascunho_id"),
	CONSTRAINT "id_no_formato" CHECK ("chamados"."id" ~ '^(INC|REQ)-[0-9]{1,9}$'),
	CONSTRAINT "dono_corporativo" CHECK ("chamados"."dono" ~ '^[a-z0-9._%+-]+@nexo\.com$')
);
--> statement-breakpoint
CREATE TABLE "complementos" (
	"id" serial PRIMARY KEY NOT NULL,
	"chamado_id" text NOT NULL,
	"texto" text NOT NULL,
	"em" timestamp with time zone NOT NULL,
	"rascunho_id" text,
	CONSTRAINT "complementos_rascunho_id_unique" UNIQUE("rascunho_id")
);
--> statement-breakpoint
ALTER TABLE "complementos" ADD CONSTRAINT "complementos_chamado_id_chamados_id_fk" FOREIGN KEY ("chamado_id") REFERENCES "public"."chamados"("id") ON DELETE no action ON UPDATE no action;