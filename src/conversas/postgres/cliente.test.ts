import { conversasDeTeste } from "../../testes/banco-de-teste.js";
import { verificarContratoDeConversas } from "../contrato/index.js";

verificarContratoDeConversas("PostgreSQL (PGlite)", conversasDeTeste);
