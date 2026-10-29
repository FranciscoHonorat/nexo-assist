import { beforeAll } from "vitest";
import {
  conversasDeTeste,
  migrarBancoDeTeste,
  TEMPO_PARA_MIGRAR,
} from "../../testes/banco-de-teste.js";
import { verificarContratoDeConversas } from "../contrato/index.js";

beforeAll(migrarBancoDeTeste, TEMPO_PARA_MIGRAR);

verificarContratoDeConversas("PostgreSQL (PGlite)", conversasDeTeste);
