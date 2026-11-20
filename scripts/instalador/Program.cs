using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;

// Instalador portátil do MEDEIROS SYSTEM.
// O payload (node + harness + MausBot) vem logo após o código compilado.
// Nenhuma credencial é embutida, lida ou impressa: cada pessoa informa a sua no painel.
class Program
{
    const string MAGIA = "MSISTLR1";

    static int Main()
    {
        var etapas = new List<string>();
        bool ok = true;
        string instalacao = Environment.GetEnvironmentVariable("MEDEIROS_INSTALL_DIR");
        if (string.IsNullOrEmpty(instalacao))
            instalacao = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MedeirosSystem");

        try
        {
            string payload = Environment.GetEnvironmentVariable("MEDEIROS_PAYLOAD");
            string temporario = null;

            if (string.IsNullOrEmpty(payload))
            {
                string eu = Assembly.GetExecutingAssembly().Location;
                byte[] bytes = File.ReadAllBytes(eu);
                if (bytes.Length < 24) throw new Exception("Instalador invalido: arquivo muito curto.");
                string assinatura = Encoding.ASCII.GetString(bytes, bytes.Length - 8, 8);
                if (assinatura != MAGIA) throw new Exception("Instalador invalido: assinatura ausente.");
                ulong tamanho = BitConverter.ToUInt64(bytes, bytes.Length - 16);
                if (tamanho == 0 || tamanho > (ulong)bytes.Length - 16)
                    throw new Exception("Instalador invalido: tamanho inconsistente.");
                int inicio = checked((int)((ulong)bytes.Length - 16 - tamanho));
                temporario = Path.Combine(Path.GetTempPath(), "medeiros-payload-" + Guid.NewGuid().ToString("N") + ".tar.gz");
                byte[] pedaco = new byte[(int)tamanho];
                Array.Copy(bytes, inicio, pedaco, 0, (int)tamanho);
                File.WriteAllBytes(temporario, pedaco);
                payload = temporario;
            }

            Directory.CreateDirectory(instalacao);
            string tar = Path.Combine(Environment.GetEnvironmentVariable("SystemRoot") ?? @"C:\Windows", @"System32\tar.exe");
            if (!File.Exists(tar)) tar = "tar.exe";
            var extrair = new ProcessStartInfo(tar, "-xzf \"" + payload + "\" -C \"" + instalacao + "\"");
            extrair.UseShellExecute = false;
            extrair.CreateNoWindow = true;
            extrair.RedirectStandardError = true;
            using (var p = Process.Start(extrair))
            {
                string erro = p.StandardError.ReadToEnd();
                p.WaitForExit();
                if (p.ExitCode != 0) throw new Exception("Falha ao extrair: " + erro);
            }
            etapas.Add("extracao");
            if (temporario != null) Apagar(temporario);

            string node = Path.Combine(instalacao, "node", "node.exe");
            string cli = Path.Combine(instalacao, "mausbot", "cli.js");
            string painel = Path.Combine(instalacao, "app", "scripts", "ui", "server.mjs");
            if (!File.Exists(node) || !File.Exists(cli) || !File.Exists(painel))
                throw new Exception("Payload incompleto apos extracao.");
            File.WriteAllText(Path.Combine(instalacao, "versao.txt"),
                DateTime.UtcNow.ToString("O") + "\n" + MAGIA + "\n");
            etapas.Add("versao");

            if (Environment.GetEnvironmentVariable("MEDEIROS_NO_MCP") != "1")
            {
                var mcp = new ProcessStartInfo(node, "\"" + Path.Combine(instalacao, "app", "scripts", "instalar-mcp.mjs") + "\"");
                mcp.UseShellExecute = false;
                mcp.CreateNoWindow = true;
                mcp.RedirectStandardError = true;
                mcp.WorkingDirectory = Path.Combine(instalacao, "app");
                mcp.EnvironmentVariables["OPENMAUSBOT_CLI"] = cli;
                using (var p = Process.Start(mcp))
                {
                    string erro = p.StandardError.ReadToEnd();
                    p.WaitForExit();
                    if (p.ExitCode != 0) throw new Exception("Falha ao registrar MCP: " + erro);
                }
                etapas.Add("mcp");
            }

            if (Environment.GetEnvironmentVariable("MEDEIROS_NO_SHORTCUT") != "1")
                CriarAtalho(instalacao, node, painel, etapas);

            if (Environment.GetEnvironmentVariable("MEDEIROS_NO_LAUNCH") != "1")
            {
                var iniciar = new ProcessStartInfo(node, "\"" + painel + "\"");
                iniciar.UseShellExecute = false;
                iniciar.CreateNoWindow = false;
                iniciar.WorkingDirectory = Path.Combine(instalacao, "app");
                iniciar.EnvironmentVariables["PORTA"] = "8765";
                Process.Start(iniciar);
                etapas.Add("painel");
                try { Process.Start(new ProcessStartInfo("http://127.0.0.1:8765") { UseShellExecute = true }); }
                catch { }
            }
        }
        catch (Exception e)
        {
            ok = false;
            etapas.Add("erro: " + e.Message);
        }

        var partes = new List<string>();
        foreach (var etapa in etapas) partes.Add(Json(etapa));
        Console.WriteLine("{\"ok\":" + (ok ? "true" : "false") +
            ",\"instalacao\":" + Json(instalacao) +
            ",\"etapas\":[" + string.Join(",", partes.ToArray()) + "]}");
        return ok ? 0 : 1;
    }

    static void Apagar(string arquivo)
    {
        try { File.Delete(arquivo); }
        catch { }
    }

    static void CriarAtalho(string instalacao, string node, string painel, List<string> etapas)
    {
        try
        {
            Type tipo = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(tipo);
            string programas = (string)tipo.InvokeMember("SpecialFolders",
                BindingFlags.GetProperty, null, shell, new object[] { "Programs" });
            string destino = Path.Combine(programas, "MEDEIROS SYSTEM");
            Directory.CreateDirectory(destino);
            string lnk = Path.Combine(destino, "Abrir painel.lnk");
            object atalho = tipo.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
            tipo.InvokeMember("TargetPath", BindingFlags.SetProperty, null, atalho, new object[] { node });
            tipo.InvokeMember("Arguments", BindingFlags.SetProperty, null, atalho, new object[] { "\"" + painel + "\"" });
            tipo.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, atalho,
                new object[] { Path.Combine(instalacao, "app") });
            tipo.InvokeMember("Description", BindingFlags.SetProperty, null, atalho,
                new object[] { "MEDEIROS SYSTEM - painel local e credenciais proprias" });
            tipo.InvokeMember("Save", BindingFlags.InvokeMethod, null, atalho, new object[0]);
            etapas.Add("atalho");
        }
        catch
        {
            etapas.Add("atalho-ignorado");
        }
    }

    static string Json(string valor)
    {
        if (valor == null) return "null";
        var saida = new StringBuilder("\"");
        foreach (char c in valor)
        {
            if (c == '"' || c == '\\') saida.Append('\\').Append(c);
            else if (c == '\r') saida.Append("\\r");
            else if (c == '\n') saida.Append("\\n");
            else if (c == '\t') saida.Append("\\t");
            else if (c < 32) saida.Append("\\u").Append(((int)c).ToString("x4"));
            else saida.Append(c);
        }
        return saida.Append('"').ToString();
    }
}
