// Converte o nome de ícone do catálogo (kebab-case do lucide) num componente.
// Só os ícones listados aqui entram no bundle; um nome desconhecido cai no `Sparkles`.
import {
  BadgeCheck, BookOpen, Bot, BrainCircuit, Building2, Calendar, ChartColumn, ChartLine, ChartNoAxesCombined,
  ClipboardCheck, CloudUpload, Compass, FilePen, FilePlus, FileSpreadsheet, FileText, FolderOpen, FolderPlus,
  GalleryHorizontal, GitBranch, Globe, Hammer, Images, Layers, LayoutTemplate, Lightbulb, ListChecks, ListTodo,
  Mail, MailPlus, Map as Mapa, MapPin, Megaphone, MessageSquareHeart, MessageSquareQuote, MessagesSquare, Newspaper,
  Palette, PenTool, Pencil, Plug, Radar, RefreshCw, Repeat, Rocket, Route, Save, ScrollText, Search, Send, Sparkles, Star,
  Store, SunMedium, Sunrise, Table, Target, Telescope, Terminal, TrendingUp, Users, WandSparkles, Workflow, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react'

const ICONES: Record<string, LucideIcon> = {
  'badge-check': BadgeCheck, 'book-open': BookOpen, bot: Bot, 'brain-circuit': BrainCircuit, 'building-2': Building2,
  calendar: Calendar, 'chart-column': ChartColumn, 'bar-chart-3': ChartColumn, 'chart-line': ChartLine,
  'line-chart': ChartLine, 'chart-no-axes-combined': ChartNoAxesCombined, 'clipboard-check': ClipboardCheck,
  'cloud-upload': CloudUpload, 'upload-cloud': CloudUpload, compass: Compass, 'file-pen': FilePen, 'file-plus': FilePlus,
  'file-spreadsheet': FileSpreadsheet, 'file-text': FileText, 'folder-open': FolderOpen, 'folder-plus': FolderPlus,
  'gallery-horizontal': GalleryHorizontal, 'git-branch': GitBranch, globe: Globe, hammer: Hammer, images: Images,
  layers: Layers, 'layout-template': LayoutTemplate, lightbulb: Lightbulb, 'list-checks': ListChecks,
  'list-todo': ListTodo, mail: Mail, 'mail-plus': MailPlus, map: Mapa, 'map-pin': MapPin, megaphone: Megaphone,
  'message-square-heart': MessageSquareHeart, 'message-square-quote': MessageSquareQuote,
  'messages-square': MessagesSquare, newspaper: Newspaper, palette: Palette, 'pen-tool': PenTool, pencil: Pencil,
  plug: Plug, radar: Radar, 'refresh-cw': RefreshCw, repeat: Repeat, rocket: Rocket, route: Route, save: Save, 'scroll-text': ScrollText,
  search: Search, send: Send, sparkles: Sparkles, star: Star, store: Store, 'sun-medium': SunMedium, sunrise: Sunrise,
  table: Table, target: Target, telescope: Telescope, terminal: Terminal, 'trending-up': TrendingUp, users: Users,
  'wand-sparkles': WandSparkles, workflow: Workflow, wrench: Wrench, zap: Zap,
}

export function iconeDaSkill(nome: string): LucideIcon {
  return ICONES[nome] ?? Sparkles
}

/** Ícone pra uma ferramenta do agente na linha do tempo, pelo nome que o CLI usa. */
export function iconeDaFerramenta(nome: string): LucideIcon {
  const n = nome.toLowerCase()
  if (/(write|edit|replace|patch|file_change|notebook)/.test(n)) return FilePen
  if (/(read|view|cat|open)/.test(n)) return FileText
  if (/(bash|command|shell|exec|run|terminal)/.test(n)) return Terminal
  if (/(grep|glob|search|find|ls|list)/.test(n)) return /web/.test(n) ? Globe : Search
  if (/(web|fetch|http|browse)/.test(n)) return Globe
  if (/todo|plan/.test(n)) return ListTodo
  if (/mcp/.test(n)) return Plug
  if (/(task|agent)/.test(n)) return Bot
  return Wrench
}
