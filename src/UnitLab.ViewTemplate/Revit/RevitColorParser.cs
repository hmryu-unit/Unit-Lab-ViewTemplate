using System;
using System.Globalization;
using Autodesk.Revit.DB;

namespace UnitLab.ViewTemplate.Revit;

public static class RevitColorParser
{
    public static bool TryParse(string? value, out Color color)
    {
        color = default!;
        if (string.IsNullOrWhiteSpace(value))
            return false;

        string trimmed = value.Trim();
        if (trimmed.Equals("ByCategory", StringComparison.OrdinalIgnoreCase)
            || trimmed.Equals("ByView", StringComparison.OrdinalIgnoreCase))
            return false;

        if (!trimmed.StartsWith('#'))
            trimmed = "#" + trimmed;

        if (trimmed.Length != 7 && trimmed.Length != 4)
            return false;

        try
        {
            if (trimmed.Length == 7)
            {
                byte r = byte.Parse(trimmed.Substring(1, 2), NumberStyles.HexNumber);
                byte g = byte.Parse(trimmed.Substring(3, 2), NumberStyles.HexNumber);
                byte b = byte.Parse(trimmed.Substring(5, 2), NumberStyles.HexNumber);
                color = new Color(r, g, b);
                return true;
            }

            byte r4 = byte.Parse(trimmed[1].ToString() + trimmed[1], NumberStyles.HexNumber);
            byte g4 = byte.Parse(trimmed[2].ToString() + trimmed[2], NumberStyles.HexNumber);
            byte b4 = byte.Parse(trimmed[3].ToString() + trimmed[3], NumberStyles.HexNumber);
            color = new Color(r4, g4, b4);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
