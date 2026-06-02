using System.IO;
using System.Reflection;

namespace UnitLab.ViewTemplate.Infrastructure;

public static class PresetPaths
{
    public static string GetDefaultPresetsFolder()
    {
        string? assemblyDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        if (assemblyDir is null)
            return string.Empty;

        string nextToDll = Path.Combine(assemblyDir, "Presets");
        if (Directory.Exists(nextToDll))
            return nextToDll;

        // 개발 시: repo 루트 Presets
        string? dir = assemblyDir;
        for (int i = 0; i < 8 && dir is not null; i++)
        {
            string candidate = Path.Combine(dir, "Presets");
            if (Directory.Exists(candidate))
                return candidate;

            dir = Directory.GetParent(dir)?.FullName;
        }

        return nextToDll;
    }
}
