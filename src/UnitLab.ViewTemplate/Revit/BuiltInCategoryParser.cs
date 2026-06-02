using System;
using Autodesk.Revit.DB;

namespace UnitLab.ViewTemplate.Revit;

/// <summary>
/// JSON/HTML의 "Walls" 또는 "OST_Walls" 형식을 Revit BuiltInCategory로 변환합니다.
/// </summary>
public static class BuiltInCategoryParser
{
    public static bool TryParse(string name, out BuiltInCategory builtInCategory)
    {
        builtInCategory = default;
        if (string.IsNullOrWhiteSpace(name))
            return false;

        string trimmed = name.Trim();

        if (Enum.TryParse(trimmed, ignoreCase: true, out builtInCategory))
            return true;

        if (!trimmed.StartsWith("OST_", StringComparison.OrdinalIgnoreCase))
        {
            string withPrefix = "OST_" + trimmed;
            if (Enum.TryParse(withPrefix, ignoreCase: true, out builtInCategory))
                return true;
        }

        if (trimmed.StartsWith("OST_", StringComparison.OrdinalIgnoreCase))
        {
            string withoutPrefix = trimmed[4..];
            if (Enum.TryParse(withoutPrefix, ignoreCase: true, out builtInCategory))
                return true;
        }

        return false;
    }
}
