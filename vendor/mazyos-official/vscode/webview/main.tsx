// Ponto de entrada da interface: monta o painel (barra lateral) ou o console do Mazy.
import './estilos/tokens.css'
import './estilos/base.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { aplicar } from './estado'
import { aoReceber, enviar } from './ponte'
import { Avisos } from './componentes/Avisos'
import { Console } from './componentes/Console'
import { Painel } from './componentes/Painel'

const view = window.mazyos?.view ?? 'painel'
document.body.dataset.view = view

aoReceber(aplicar)

const raiz = document.getElementById('raiz')
if (raiz) {
  createRoot(raiz).render(
    <StrictMode>
      {view === 'console' ? <Console /> : <Painel />}
      <Avisos />
    </StrictMode>,
  )
}

enviar({ tipo: 'pronto' })
