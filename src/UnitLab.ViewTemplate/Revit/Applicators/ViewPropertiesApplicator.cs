using System;
using Autodesk.Revit.DB;
using UnitLab.ViewTemplate.Core.Models;

namespace UnitLab.ViewTemplate.Revit.Applicators;

public sealed class ViewPropertiesApplicator : IViewSettingApplicator
{
    public int Order => 10;

    public bool CanApply(View view, ViewTemplatePreset preset) => preset.Properties is not null;

    public void Apply(View view, ViewTemplatePreset preset, ApplyContext context)
    {
        ViewPropertiesSpec props = preset.Properties!;

        if (!string.IsNullOrWhiteSpace(props.Discipline)
            && Enum.TryParse(props.Discipline, ignoreCase: true, out ViewDiscipline discipline))
        {
            view.Discipline = discipline;
        }
        else if (!string.IsNullOrWhiteSpace(props.Discipline))
        {
            context.Warnings.Add($"알 수 없는 discipline: {props.Discipline}");
        }

        if (!string.IsNullOrWhiteSpace(props.DetailLevel)
            && Enum.TryParse(props.DetailLevel, ignoreCase: true, out ViewDetailLevel detailLevel))
        {
            view.DetailLevel = detailLevel;
        }
        else if (!string.IsNullOrWhiteSpace(props.DetailLevel))
        {
            context.Warnings.Add($"알 수 없는 detailLevel: {props.DetailLevel}");
        }
    }
}
