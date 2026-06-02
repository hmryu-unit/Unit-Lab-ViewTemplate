using System;
using Autodesk.Revit.DB;
using UnitLab.ViewTemplate.Core.Models;

namespace UnitLab.ViewTemplate.Revit.Applicators;

public sealed class CategoryOverridesApplicator : IViewSettingApplicator
{
    public int Order => 20;

    public bool CanApply(View view, ViewTemplatePreset preset) => preset.CategoryOverrides.Count > 0;

    public void Apply(View view, ViewTemplatePreset preset, ApplyContext context)
    {
        Document doc = context.Document;

        foreach (CategoryOverrideSpec spec in preset.CategoryOverrides)
        {
            if (!BuiltInCategoryParser.TryParse(spec.BuiltInCategory, out BuiltInCategory builtIn))
            {
                context.Warnings.Add($"알 수 없는 builtInCategory: {spec.BuiltInCategory}");
                continue;
            }

            Category? category = Category.GetCategory(doc, builtIn);
            if (category is null || !category.get_AllowsVisibilityControl(view))
            {
                context.Warnings.Add($"카테고리를 찾을 수 없음: {spec.BuiltInCategory}");
                continue;
            }

            if (spec.Hidden.HasValue)
                view.SetCategoryHidden(category.Id, spec.Hidden.Value);

            bool hasGraphicOverride = spec.Halftone.HasValue
                || spec.Projection is { IsEmpty: false }
                || spec.Cut is { IsEmpty: false }
                || spec.Surface is { IsEmpty: false };

            if (!hasGraphicOverride)
                continue;

            OverrideGraphicSettings ogs = view.GetCategoryOverrides(category.Id)
                ?? new OverrideGraphicSettings();

            if (spec.Halftone.HasValue)
                ogs.SetHalftone(spec.Halftone.Value);

            OverrideGraphicSettingsMerger.Apply(ogs, spec.Projection, GraphicSettingsScope.Projection, doc, context);
            OverrideGraphicSettingsMerger.Apply(ogs, spec.Cut, GraphicSettingsScope.Cut, doc, context);
            OverrideGraphicSettingsMerger.Apply(ogs, spec.Surface, GraphicSettingsScope.Surface, doc, context);

            view.SetCategoryOverrides(category.Id, ogs);
        }
    }
}
