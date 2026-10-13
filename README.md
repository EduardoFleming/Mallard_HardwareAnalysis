# HardwareAnalysis

Aplicativo desktop para conhecer os componentes do computador e receber recomendações de upgrade com ajuda do Gemini. O consultor considera o perfil de uso, o orçamento e as informações disponíveis sobre o hardware para explicar **o que pode valer a pena atualizar e o que confirmar antes de comprar**.

## Recursos

- Tela de componentes detectados: processador, placa de vídeo, memória, placa-mãe, armazenamento e sistema operacional.
- Monitoramento ao vivo de CPU e memória, com gráfico do último minuto.
- Leitura opcional de uso e temperatura de GPU NVIDIA compatível.
- Consultoria para jogos, trabalho e uso doméstico, com perguntas específicas para cada perfil.
- Campos opcionais para orçamento, resolução, fonte, placa-mãe e outros dados que ajudam a conferir compatibilidade.
- Recomendações priorizadas, com justificativa e pontos a verificar antes da compra.
- Temas claro e escuro; a preferência fica salva entre execuções.

## Requisitos

- Python 3.12 recomendado.
- Conexão com a internet na primeira execução, para que o aplicativo instale as dependências que estiverem faltando.
- Uma chave da API Gemini para usar o consultor de upgrades.

O aplicativo foi planejado para Windows, Linux e macOS. A identificação de alguns componentes e sensores varia conforme o sistema, as permissões e os drivers instalados. A leitura de GPU atualmente usa NVML, voltada a placas NVIDIA compatíveis.

## Instalação e execução

Clone ou baixe o repositório, abra um terminal na pasta do projeto e execute:

```bash
python app.py
```

`app.py` inicia a interface desktop do HardwareAnalysis. Na primeira execução, o `main.py` verifica e instala as dependências Python necessárias usando o mesmo interpretador. No Windows, também tenta instalar WMI/PyWin32; NVML é instalado para habilitar sensores NVIDIA. Se a instalação automática falhar, o aplicativo informa o comando de instalação.

Também é possível iniciar diretamente com `python main.py`.

## Configurar o Gemini

1. Crie uma chave no [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Abra o HardwareAnalysis e informe a chave no campo **Chave Gemini**, na barra lateral.
3. Acesse **Consultor de upgrades**, escolha o tipo de uso e clique em **Analisar meu computador**.

A chave digitada fica apenas na sessão atual e não é gravada pelo aplicativo. Se quiser evitar digitá-la em cada execução, configure `GEMINI_API_KEY` no ambiente antes de abrir o app.

O campo da chave mostra um indicador quando há uma chave digitada e exibe apenas seus últimos quatro caracteres. Na área do consultor, o aplicativo identifica o modelo configurado para a análise.

Ao solicitar uma análise, os componentes detectados e as preferências preenchidas são enviados ao serviço Gemini. A coleta e o monitoramento de hardware acontecem localmente.

## Como usar o consultor

- Selecione **Jogos**, **Trabalho** ou **Uso doméstico**. As perguntas seguintes mudam conforme a escolha.
- Em jogos, indique se o foco são competitivos leves, títulos AAA, jogos indie ou outro perfil. É possível informar um jogo específico.
- Informe o orçamento se tiver um limite. Se ele não comportar uma melhoria que valha a pena, o consultor deve explicar isso sem recomendar ultrapassá-lo.
- Os campos adicionais de compatibilidade são opcionais. Se não souber uma informação, deixe-a em branco; ela será desconsiderada.

## Limites das recomendações e preços

O Gemini auxilia na análise, mas não substitui a confirmação de compatibilidade. Soquete, BIOS, fonte, dimensões do gabinete e tipo de memória podem exigir conferência manual, especialmente em computadores OEM.

O aplicativo **não consulta preços em tempo real**. Os botões de pesquisa abrem resultados de produtos; eles não são cotações e podem incluir ofertas indisponíveis ou incompatíveis. Confirme preço, estoque, vendedor e compatibilidade na loja antes de comprar.

Cada clique em **Analisar meu computador** faz uma solicitação ao Gemini; o app não atualiza nem chama a IA em segundo plano. Se a API retornar limite de uso (`429`), o app informa o tempo de espera fornecido pelo Google. O limite depende da cota atual do projeto e do modelo.

## Estrutura do projeto

- `app.py`: ponto de entrada recomendado.
- `main.py`: interface PySide6, verificação de dependências, formulários e apresentação das recomendações.
- `hardwareInfo.py`: descoberta de componentes com caminhos específicos por sistema operacional.
- `hardwareMonitoring.py`: métricas de CPU, memória e provedor NVIDIA NVML opcional.
- `aiAnalysis.py`: instruções do consultor, validação da resposta JSON e links de pesquisa.
