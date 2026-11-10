#define AppName "Mallard"
#define AppVersion "4.1.1"
#define AppPublisher "Eduardo Fleming Diniz"
#define AppExeName "Mallard.exe"

[Setup]
AppId={{C7CFA3A4-E425-4B21-B95A-C8B293F6C73D}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={localappdata}\Programs\Mallard
DefaultGroupName=Mallard
DisableProgramGroupPage=yes
OutputDir=..\release
OutputBaseFilename=Mallard-Setup-{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
UninstallDisplayIcon={app}\Mallard.ico
SetupIconFile=..\build-assets\Mallard.ico
SetupLogging=yes

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar um atalho na Área de Trabalho"; GroupDescription: "Atalhos adicionais:"; Flags: unchecked

[Files]
Source: "..\dist\Mallard.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\build-assets\Mallard.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Mallard"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\Mallard.ico"
Name: "{autodesktop}\Mallard"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\Mallard.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "Abrir Mallard"; Flags: postinstall nowait skipifsilent

[Code]
function IsWebView2Installed: Boolean;
var
  Version: String;
begin
  Result :=
    RegQueryStringValue(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) or
    RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  Bootstrapper: String;
begin
  Result := '';
  if IsWebView2Installed then
    exit;

  if MsgBox('O componente Microsoft Edge WebView2 é necessário para abrir a interface do Mallard. Deseja baixá-lo e instalá-lo agora?', mbConfirmation, MB_YESNO) = IDNO then
  begin
    Result := 'A instalação do WebView2 foi cancelada. O Mallard precisa desse componente para funcionar.';
    exit;
  end;

  Bootstrapper := ExpandConstant('{tmp}\MicrosoftEdgeWebView2Setup.exe');
  try
    DownloadTemporaryFile('https://go.microsoft.com/fwlink/p/?LinkId=2124703', 'MicrosoftEdgeWebView2Setup.exe', '', nil);
  except
    Result := 'Não foi possível baixar o WebView2. Verifique a conexão e tente novamente.';
    exit;
  end;

  if not Exec(Bootstrapper, '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Result := 'Não foi possível iniciar a instalação do WebView2.';
    exit;
  end;
  if (ResultCode <> 0) and (ResultCode <> 3010) then
    Result := 'A instalação do WebView2 terminou com o código ' + IntToStr(ResultCode) + '.';
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  FindRec: TFindRec;
  PackagesPath: String;
  LegacyMallardPath: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    if MsgBox(
      'Deseja apagar também os dados locais do Mallard deste usuário?' + #13#10 + #13#10 +
      'Isso remove preferências, histórico, diário e a chave Gemini salva. Esta ação não pode ser desfeita.',
      mbConfirmation, MB_YESNO or MB_DEFBUTTON2
    ) = IDYES then
    begin
      DelTree(ExpandConstant('{userappdata}\Mallard'), True, True, True);
      { Remove also older saves copied out of Microsoft Store Python sandboxes,
        or the next install would migrate them back after the user chose Delete. }
      PackagesPath := AddBackslash(ExpandConstant('{localappdata}')) + 'Packages';
      if FindFirst(AddBackslash(PackagesPath) + 'PythonSoftwareFoundation.Python.*', FindRec) then
      begin
        try
          repeat
            if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then
            begin
              LegacyMallardPath := AddBackslash(PackagesPath) + FindRec.Name + '\LocalCache\Roaming\Mallard';
              if DirExists(LegacyMallardPath) then
                DelTree(LegacyMallardPath, True, True, True);
            end;
          until not FindNext(FindRec);
        finally
          FindClose(FindRec);
        end;
      end;
    end;
  end;
end;
