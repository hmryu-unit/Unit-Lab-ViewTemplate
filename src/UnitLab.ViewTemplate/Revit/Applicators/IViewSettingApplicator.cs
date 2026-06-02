using Autodesk.Revit.DB;
using UnitLab.ViewTemplate.Core.Models;

namespace UnitLab.ViewTemplate.Revit.Applicators;

public interface IViewSettingApplicator
{
    int Order { get; }

    bool CanApply(View view, ViewTemplatePreset preset);

    void Apply(View view, ViewTemplatePreset preset, ApplyContext context);
}
