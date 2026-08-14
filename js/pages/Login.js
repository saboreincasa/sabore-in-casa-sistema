import { html, useState } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { BUCKET_URL } from "../config.js";

export function LoginPage() {
  const [mode, setMode] = useState("login"); // login | signup
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [avisoConfirmacao, setAvisoConfirmacao] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else {
        if (!nome.trim()) throw new Error("Informe seu nome.");
        if (senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
        const { data, error } = await supabase.auth.signUp({
          email, password: senha, options: { data: { nome } },
        });
        if (error) throw error;
        if (!data.session) {
          setAvisoConfirmacao(true);
        }
      }
    } catch (err) {
      setErro(traduzErro(err.message));
    } finally {
      setLoading(false);
    }
  }

  if (avisoConfirmacao) {
    return html`
      <div class="login-page">
        <div class="login-card">
          <img src=${BUCKET_URL + "logo.webp"} alt="Sabore In Casa" />
          <h2 class="h2" style="font-size:18px;">Confirme seu e-mail</h2>
          <p class="muted-text">Enviamos um link de confirmação para <strong>${email}</strong>. Depois de confirmar, volte aqui e faça login.</p>
          <button class="btn btn-primary" style="width:100%;margin-top:8px;" onClick=${() => { setAvisoConfirmacao(false); setMode("login"); }}>Voltar para login</button>
        </div>
      </div>
    `;
  }

  return html`
    <div class="login-page">
      <div class="login-card">
        <img src=${BUCKET_URL + "logo.webp"} alt="Sabore In Casa" />
        <div class="login-tabs">
          <button type="button" class="login-tab ${mode === "login" ? "active" : ""}" onClick=${() => setMode("login")}>Entrar</button>
          <button type="button" class="login-tab ${mode === "signup" ? "active" : ""}" onClick=${() => setMode("signup")}>Criar conta</button>
        </div>
        <form onSubmit=${handleSubmit} class="stack-4" style="text-align:left;">
          ${mode === "signup" ? html`
            <div class="field">
              <label>Seu nome</label>
              <input class="input" value=${nome} onInput=${(e) => setNome(e.target.value)} required />
            </div>
          ` : null}
          <div class="field">
            <label>E-mail</label>
            <input class="input" type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} required />
          </div>
          <div class="field">
            <label>Senha</label>
            <input class="input" type="password" value=${senha} onInput=${(e) => setSenha(e.target.value)} minlength="6" required />
          </div>
          ${erro ? html`<p class="error-text">${erro}</p>` : null}
          <button class="btn btn-primary" type="submit" disabled=${loading} style="width:100%;">
            ${loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <p class="muted-text small" style="margin-top:16px;">O primeiro cadastro se torna Administrador automaticamente.</p>
      </div>
    </div>
  `;
}

function traduzErro(msg) {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/user already registered/i.test(msg)) return "Esse e-mail já tem cadastro. Tente entrar.";
  if (/password should be at least/i.test(msg)) return "A senha precisa ter pelo menos 6 caracteres.";
  return msg;
}
