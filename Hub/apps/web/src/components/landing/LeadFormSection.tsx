'use client';

import { useState } from 'react';

export function LeadFormSection() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    whats: '',
    area: '',
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) {
      v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
    } else if (v.length > 2) {
      v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    } else if (v.length > 0) {
      v = `(${v}`;
    }
    setFormData((prev) => ({ ...prev, whats: v }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.email.trim() || !formData.whats.trim()) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.whatsappUrl) {
        setWhatsappUrl(data.whatsappUrl);
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      // Fallback
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="form-sec" id="contato">
      <div className="landing-wrap">
        <div className="form-grid">
          <div className="form-side reveal in">
            <h2 className="landing-serif">
              Pronto para simplificar sua rotina? <em>Fale com a Hexx.</em>
            </h2>
            <p>
              Tire suas dúvidas ou solicite um diagnóstico gratuito da sua empresa direto com um especialista.
            </p>
            <ul className="form-points">
              <li>
                <span className="ck">
                  <svg width="11" height="9" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 5l3.5 3.5L11 1" />
                  </svg>
                </span>
                Diagnóstico gratuito e sem compromisso
              </li>
              <li>
                <span className="ck">
                  <svg width="11" height="9" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 5l3.5 3.5L11 1" />
                  </svg>
                </span>
                Demonstração prática do Hub funcionando
              </li>
              <li>
                <span className="ck">
                  <svg width="11" height="9" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 5l3.5 3.5L11 1" />
                  </svg>
                </span>
                Atendimento direto com especialista humano
              </li>
            </ul>
          </div>

          <div className="form-card reveal in reveal-d1">
            {!submitted ? (
              <form onSubmit={handleSubmit} noValidate>
                <div className="field">
                  <label htmlFor="nome">Nome Completo</label>
                  <input
                    type="text"
                    id="nome"
                    placeholder="Seu nome ou da sua empresa"
                    required
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="email">E-mail Profissional</label>
                  <input
                    type="email"
                    id="email"
                    placeholder="voce@suaempresa.com.br"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="whats">WhatsApp com DDD</label>
                  <input
                    type="tel"
                    id="whats"
                    placeholder="(00) 00000-0000"
                    required
                    value={formData.whats}
                    onChange={handlePhoneChange}
                  />
                </div>
                <div className="field">
                  <label htmlFor="area">Área de Atuação</label>
                  <select
                    id="area"
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  >
                    <option value="" disabled>
                      Selecione a sua atividade
                    </option>
                    <option>Consultoria / Assessoria</option>
                    <option>Tecnologia / Software / Dev</option>
                    <option>Design / Criativo / Agência</option>
                    <option>Saúde / Bem-estar / Terapias</option>
                    <option>Advocacia / Jurídico</option>
                    <option>Educação / Treinamento / Mentorias</option>
                    <option>Holding / Gestão Patrimonial</option>
                    <option>Outros serviços</option>
                  </select>
                </div>
                <button type="submit" className="btn-landing btn-landing-green" disabled={loading}>
                  {loading ? 'Enviando...' : 'Quero Conhecer o Hub →'}
                </button>
                <p className="form-note">Seus dados estão 100% seguros. Resposta em até 1 dia útil.</p>
              </form>
            ) : (
              <div className="form-ok" id="form-ok">
                <span className="ck">
                  <svg width="20" height="16" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M1 5l3.5 3.5L11 1" />
                  </svg>
                </span>
                <h3 className="landing-serif">Solicitação Recebida!</h3>
                <p>Nossa equipe já recebeu seus dados e entrará em contato em breve.</p>
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-landing btn-landing-lime"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    Falar pelo WhatsApp Agora ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
