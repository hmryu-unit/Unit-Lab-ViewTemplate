using System;
using System.IO;
using System.Text;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using UnitLab.ViewTemplate.Core.Models;
using UnitLab.ViewTemplate.Core.Presets;
using UnitLab.ViewTemplate.Infrastructure;
using UnitLab.ViewTemplate.Revit.Services;

namespace UnitLab.ViewTemplate.Commands;

[Transaction(TransactionMode.Manual)]
public sealed class CreateTemplateFromPresetCommand : IExternalCommand
{
    public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
    {
        UIDocument? uiDoc = commandData.Application.ActiveUIDocument;
        if (uiDoc?.Document is not { } doc)
        {
            message = "열린 문서가 없습니다.";
            return Result.Failed;
        }

        string? jsonPath = PresetFilePicker.PickPresetJsonPath();
        if (jsonPath is null)
            return Result.Cancelled;

        ViewTemplatePreset preset;
        try
        {
            preset = JsonPresetLoader.LoadFromFile(jsonPath);
        }
        catch (Exception ex)
        {
            message = ex.Message;
            TaskDialog.Show("Preset 오류", ex.Message);
            return Result.Failed;
        }

        var service = new ViewTemplateService();
        CreateTemplateResult result;

        using (var tx = new Transaction(doc, "Create View Template from Preset"))
        {
            tx.Start();
            try
            {
                result = service.CreateFromPreset(doc, preset);
                tx.Commit();
            }
            catch (Exception ex)
            {
                tx.RollBack();
                message = ex.Message;
                TaskDialog.Show("생성 실패", ex.Message);
                return Result.Failed;
            }
        }

        var report = new StringBuilder();
        report.AppendLine($"View Template을 생성했습니다.");
        report.AppendLine();
        report.AppendLine($"이름: {result.Template.Name}");
        report.AppendLine($"Id: {result.Template.Id}");
        report.AppendLine($"Preset: {Path.GetFileName(jsonPath)}");

        string warnings = ViewTemplateService.FormatWarnings(result.Context);
        if (!string.IsNullOrEmpty(warnings))
            report.Append(warnings);

        TaskDialog.Show("UnitLab View Template", report.ToString());
        return Result.Succeeded;
    }
}
