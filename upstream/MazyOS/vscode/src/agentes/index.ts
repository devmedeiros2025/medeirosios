// Os três adaptadores, pelo id.
import type { AgenteId } from '../shared/protocolo'
import { antigravity } from './antigravity'
import { claude } from './claude'
import { codex } from './codex'
import type { Agente } from './tipos'

export const AGENTES: Readonly<Record<AgenteId, Agente>> = { claude, codex, antigravity }
export const IDS_AGENTES: readonly AgenteId[] = ['claude', 'codex', 'antigravity']
