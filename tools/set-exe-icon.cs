using System;
using System.IO;
using System.Collections.Generic;
using System.Runtime.InteropServices;

// Rewrites the embedded icon resources of a Windows exe.
// ICO entries overwrite RT_ICON 1..N; RT_GROUP_ICON 1 is rebuilt to point at them,
// so no old icon image survives in the resource table.
public static class IcoInjector
{
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr BeginUpdateResource(string pFileName, bool bDeleteExistingResources);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool UpdateResource(IntPtr hUpdate, IntPtr lpType, IntPtr lpName, ushort wLanguage, byte[] lpData, uint cbData);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool EndUpdateResource(IntPtr hUpdate, bool fDiscard);

    const int RT_ICON = 3;
    const int RT_GROUP_ICON = 14;

    public static string Apply(string exePath, string icoPath)
    {
        byte[] all = File.ReadAllBytes(icoPath);
        int count = BitConverter.ToUInt16(all, 4);

        List<byte[]> images = new List<byte[]>();
        List<ushort[]> metas = new List<ushort[]>();

        for (int i = 0; i < count; i++)
        {
            int off = 6 + i * 16;
            byte iw = all[off];
            byte ih = all[off + 1];
            byte cc = all[off + 2];
            byte rv = all[off + 3];
            ushort pl = BitConverter.ToUInt16(all, off + 4);
            ushort bpp = BitConverter.ToUInt16(all, off + 6);
            int n = BitConverter.ToInt32(all, off + 8);
            int io = BitConverter.ToInt32(all, off + 12);
            byte[] img = new byte[n];
            Array.Copy(all, io, img, 0, n);
            images.Add(img);
            metas.Add(new ushort[] { iw, ih, cc, rv, pl, bpp });
        }

        IntPtr upd = BeginUpdateResource(exePath, false);
        if (upd == IntPtr.Zero)
        {
            throw new Exception("BeginUpdateResource failed: " + Marshal.GetLastWin32Error());
        }

        for (int i = 0; i < images.Count; i++)
        {
            int id = i + 1;
            if (!UpdateResource(upd, (IntPtr)RT_ICON, (IntPtr)id, 0, images[i], (uint)images[i].Length))
            {
                throw new Exception("RT_ICON " + id + " failed: " + Marshal.GetLastWin32Error());
            }
        }

        int len = 6 + images.Count * 14;
        byte[] grp = new byte[len];
        BitConverter.GetBytes((ushort)0).CopyTo(grp, 0);
        BitConverter.GetBytes((ushort)1).CopyTo(grp, 2);
        BitConverter.GetBytes((ushort)images.Count).CopyTo(grp, 4);

        for (int i = 0; i < images.Count; i++)
        {
            int off = 6 + i * 14;
            grp[off] = (byte)metas[i][0];
            grp[off + 1] = (byte)metas[i][1];
            grp[off + 2] = (byte)metas[i][2];
            grp[off + 3] = (byte)metas[i][3];
            BitConverter.GetBytes(metas[i][4]).CopyTo(grp, off + 4);
            BitConverter.GetBytes(metas[i][5]).CopyTo(grp, off + 6);
            BitConverter.GetBytes((uint)images[i].Length).CopyTo(grp, off + 8);
            BitConverter.GetBytes((ushort)(i + 1)).CopyTo(grp, off + 12);
        }

        if (!UpdateResource(upd, (IntPtr)RT_GROUP_ICON, (IntPtr)1, 0, grp, (uint)grp.Length))
        {
            throw new Exception("group failed: " + Marshal.GetLastWin32Error());
        }

        if (!EndUpdateResource(upd, false))
        {
            throw new Exception("EndUpdateResource failed: " + Marshal.GetLastWin32Error());
        }

        return "images=" + images.Count;
    }
}
