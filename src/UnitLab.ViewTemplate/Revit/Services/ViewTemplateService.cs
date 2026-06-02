using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using UnitLab.ViewTemplate.Core.Models;
using UnitLab.ViewTemplate.Revit.Applicators;

namespace UnitLab.ViewTemplate.Revit.Services;

public sealed class ViewTemplateService
{
    private readonly IReadOnlyList<IViewSettingApplicator> _applicators =
    [
        new ViewPropertiesApplicator(),
        new CategoryOverridesApplicator()
    ];

    public CreateTemplateResult CreateFromPreset(Document doc, ViewTemplatePreset preset)
    {
        if (TemplateNameExists(doc, preset.TemplateName))
            throw new System.InvalidOperationException($"이미 같은 이름의 View Template이 있습니다: {preset.TemplateName}");

        View seed = SeedViewFactory.CreateSeedView(doc, preset.ViewType);
        View template = seed.CreateViewTemplate();
        template.Name = preset.TemplateName;

        var context = new ApplyContext(doc);
        ApplyPresetToTemplate(template, preset, context);
        return new CreateTemplateResult { Template = template, Context = context };
    }

    /// <summary>
    /// 기존 View Template에 Preset의 properties + categoryOverrides를 덮어씁니다 (이름·viewType은 변경하지 않음).
    /// </summary>
    public CreateTemplateResult UpdateFromPreset(Document doc, ViewTemplatePreset preset)
    {
        if (string.IsNullOrWhiteSpace(preset.TemplateName))
            throw new System.ArgumentException("preset.templateName이 비어 있습니다.");

        View template = FindTemplateByName(doc, preset.TemplateName)
            ?? throw new System.InvalidOperationException(
                $"View Template을 찾을 수 없습니다: {preset.TemplateName}");

        var context = new ApplyContext(doc);
        ApplyPresetToTemplate(template, preset, context);
        return new CreateTemplateResult { Template = template, Context = context };
    }

    private void ApplyPresetToTemplate(View template, ViewTemplatePreset preset, ApplyContext context)
    {
        foreach (IViewSettingApplicator applicator in _applicators.OrderBy(a => a.Order))
        {
            if (applicator.CanApply(template, preset))
                applicator.Apply(template, preset, context);
        }
    }

    private static View? FindTemplateByName(Document doc, string name) =>
        new FilteredElementCollector(doc)
            .OfClass(typeof(View))
            .Cast<View>()
            .FirstOrDefault(v => v.IsTemplate && v.Name.Equals(name, System.StringComparison.OrdinalIgnoreCase));

    private static bool TemplateNameExists(Document doc, string name) =>
        new FilteredElementCollector(doc)
            .OfClass(typeof(View))
            .Cast<View>()
            .Any(v => v.IsTemplate && v.Name.Equals(name, System.StringComparison.OrdinalIgnoreCase));

    public static string FormatWarnings(ApplyContext context)
    {
        if (context.Warnings.Count == 0)
            return string.Empty;

        return "\n\n경고:\n" + string.Join("\n", context.Warnings.Select(w => "• " + w));
    }
}
