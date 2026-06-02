using System.Linq;
using System.Text;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace UnitLab.ViewTemplate.Commands;

[Transaction(TransactionMode.Manual)]
public sealed class ListViewTemplatesCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        UIDocument uiDoc = commandData.Application.ActiveUIDocument;
        if (uiDoc?.Document is not { } doc)
        {
            message = "열린 문서가 없습니다.";
            return Result.Failed;
        }

        var templates = new FilteredElementCollector(doc)
            .OfClass(typeof(View))
            .Cast<View>()
            .Where(v => v.IsTemplate)
            .OrderBy(v => v.Name)
            .Select(v => v.Name)
            .ToList();

        if (templates.Count == 0)
        {
            TaskDialog.Show("View Template", "이 프로젝트에 View Template이 없습니다.");
            return Result.Succeeded;
        }

        var body = new StringBuilder();
        body.AppendLine($"총 {templates.Count}개");
        body.AppendLine();
        foreach (string name in templates)
            body.AppendLine($"• {name}");

        TaskDialog.Show("View Template", body.ToString());

        return Result.Succeeded;
    }
}
