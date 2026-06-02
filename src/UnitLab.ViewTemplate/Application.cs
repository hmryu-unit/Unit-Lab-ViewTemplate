using Autodesk.Revit.UI;
using UnitLab.ViewTemplate.Commands;
using RibbonPanel = Autodesk.Revit.UI.RibbonPanel;

namespace UnitLab.ViewTemplate;

/// <summary>
/// Revit 시작 시 리본 탭/버튼을 등록합니다.
/// </summary>
public sealed class Application : IExternalApplication
{
    public const string TabName = "UnitLab";

    public Result OnStartup(UIControlledApplication application)
    {
        application.CreateRibbonTab(TabName);

        RibbonPanel panel = application.CreateRibbonPanel(TabName, "View Template");

        var buttonData = new PushButtonData(
            nameof(ListViewTemplatesCommand),
            "목록\n보기",
            typeof(Application).Assembly.Location,
            typeof(ListViewTemplatesCommand).FullName)
        {
            ToolTip = "프로젝트의 View Template 이름을 목록으로 표시합니다.",
            LongDescription = "현재 문서에 정의된 모든 View Template을 TaskDialog로 보여줍니다."
        };

        panel.AddItem(buttonData);

        var createFromPreset = new PushButtonData(
            nameof(CreateTemplateFromPresetCommand),
            "Preset\n생성",
            typeof(Application).Assembly.Location,
            typeof(CreateTemplateFromPresetCommand).FullName)
        {
            ToolTip = "JSON Preset 파일에서 새 View Template을 생성합니다.",
            LongDescription = "Web/ 편집기 또는 Presets 폴더의 JSON을 선택해 템플릿을 만듭니다."
        };

        panel.AddItem(createFromPreset);

        var updateFromPreset = new PushButtonData(
            nameof(UpdateTemplateFromPresetCommand),
            "Preset\n갱신",
            typeof(Application).Assembly.Location,
            typeof(UpdateTemplateFromPresetCommand).FullName)
        {
            ToolTip = "JSON Preset으로 기존 View Template의 V/G·속성을 갱신합니다.",
            LongDescription =
                "preset.templateName과 같은 이름의 View Template을 찾아 categoryOverrides와 properties를 적용합니다. 없으면 실패합니다."
        };

        panel.AddItem(updateFromPreset);

        return Result.Succeeded;
    }

    public Result OnShutdown(UIControlledApplication application) => Result.Succeeded;
}
