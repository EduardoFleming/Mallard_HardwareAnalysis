# Mallard · HardwareAnalysis

Aplicativo desktop para ler informações reais do computador, acompanhar sensores e receber recomendações de upgrade com ajuda do Gemini. O novo frontend do Mallard é HTML/CSS/JavaScript dentro de uma janela PyWebview; as leituras e ações são atendidas pelo backend Python do HardwareAnalysis.

## Recursos

- Componentes e armazenamento identificados pelo sistema, com opção de informar modelos que não puderam ser detectados.
- Nível estimado do computador e pontos de atenção calculados com as métricas lidas localmente.
- Guia didático de hardware que contextualiza os dados reais quando disponíveis.
- Monitoramento local de CPU, memória, disco e, em hardware/driver compatíveis, GPU NVIDIA.
- Consultor por perfil de uso, orçamento e preferências. Uma solicitação Gemini é feita somente ao clicar para analisar.
- Resultado detalhado, recomendações, histórico persistente, marcação de upgrades e exportação de relatório HTML.
- Temas, redução de movimento e preferências persistidos localmente.

Os desenhos do mascote, analogias, explicações e temas são conteúdo estático da interface. Métricas, componentes, análises e histórico vêm do computador, do usuário ou do backend Gemini; não há modo de demonstração no aplicativo.

## Requisitos e execução

- Python 3.12 recomendado.
- Windows, Linux ou macOS; a leitura de alguns componentes depende do sistema e dos drivers.
- Uma chave da API Gemini para usar o consultor.

Execute na pasta do projeto:

```bash
python app.py
```

O `app.py` verifica e instala as dependências necessárias usando o mesmo interpretador, e inicia o frontend local no PyWebview. Também é possível executar `python main.py`. Se a interface for aberta diretamente em um navegador comum, ela não usa dados simulados; sem a ponte Python, apresenta um erro de conexão.

## Chave do Gemini

Crie uma chave no [Google AI Studio](https://aistudio.google.com/app/apikey) e informe-a no Consultor. Opcionalmente, configure `GEMINI_API_KEY` no ambiente antes de abrir o app. A chave fornecida na interface fica apenas na memória durante a sessão e nunca é salva junto às preferências ou ao histórico.

O modelo é `gemini-3.5-flash-lite`, mantido da configuração atual do HardwareAnalysis. Cada clique no botão de análise faz, no máximo, uma chamada ao Gemini; o aplicativo não consulta a IA em segundo plano. Se o serviço informar limite de uso, a interface mostra a espera solicitada.

Ao pedir uma análise, os componentes detectados e as preferências preenchidas são enviados ao Gemini. Coleta de hardware, monitoramento e persistência são locais. O modelo auxilia, mas não substitui a confirmação de compatibilidade física/BIOS/fonte. Os links de pesquisa de produto não são cotações em tempo real.

## Dados locais

Preferências, temas, conquistas e componentes informados manualmente são guardados em `config.json`; o histórico de análises fica em `historico.json`. Ambos ficam na pasta de configuração do usuário: `%APPDATA%\Mallard` no Windows ou `~/.config/Mallard` no Linux/macOS. Esses saves não são criados dentro do repositório. A chave Gemini nunca é armazenada nesses arquivos.

O `.gitignore` também exclui esses nomes caso arquivos locais sejam colocados na pasta do projeto. O `upload.bat` confere se saves já rastreados pelo Git impediriam essa proteção e pede confirmação explícita antes de preparar commit e push. O `.gitignore` não remove arquivos que já tenham sido enviados anteriormente; confira o histórico do repositório antes de compartilhar dados antigos.

Para verificar localmente se saves/segredos estão ignorados:

```bash
git check-ignore -v config.json historico.json .env
```

Não compartilhe `config.json` ou `historico.json`: o histórico pode conter componentes do computador, preferências e respostas de análises.

## Estrutura

- `app.py`: entrada e preparação de dependências.
- `main.py`: janela PyWebview e API Python consumida pelo frontend.
- `ui/`: interface Mallard, sem payload de hardware ou resultados demonstrativos.
- `hardwareInfo.py`, `hardwareMonitoring.py`: leitura de componentes e sensores locais.
- `pcHealth.py`, `hardwareGuide.py`: classificação simples e explicações vinculadas à leitura.
- `aiAnalysis.py`: chamada Gemini, regras do consultor e validação de resposta.
- `analysisHistory.py`, `settingsStore.py`, `reportExport.py`: dados locais, preferências e exportação.

## Publicação

`upload.bat` só deve ser usado depois de testar e decidir publicar. O script pergunta explicitamente antes de adicionar arquivos, criar commit e enviar o branch atual; arquivos cobertos pelo `.gitignore` ficam fora do envio.
