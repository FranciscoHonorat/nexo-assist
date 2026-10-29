import { beforeAll } from "vitest";
import {
  bancoDeTeste,
  migrarBancoDeTeste,
  TEMPO_PARA_MIGRAR,
} from "../../testes/banco-de-teste.js";
import { verificarContratoDoTicketClient } from "../contrato/index.js";

beforeAll(migrarBancoDeTeste, TEMPO_PARA_MIGRAR);

verificarContratoDoTicketClient("PostgreSQL (PGlite)", bancoDeTeste);
