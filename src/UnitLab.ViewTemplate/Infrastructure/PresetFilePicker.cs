using System;
using System.IO;
using Microsoft.Win32;

namespace UnitLab.ViewTemplate.Infrastructure;

public static class PresetFilePicker
{
    public static string? PickPresetJsonPath()
    {
        string presetsDir = PresetPaths.GetDefaultPresetsFolder();
        var dialog = new OpenFileDialog
        {
            Title = "View Template Preset (JSON) 선택",
            Filter = "JSON (*.json)|*.json|All (*.*)|*.*",
            InitialDirectory = Directory.Exists(presetsDir)
                ? presetsDir
                : Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
        };

        return dialog.ShowDialog() == true ? dialog.FileName : null;
    }
}
