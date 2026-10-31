using System;
using System.IO;
class Harness {
 static int Main(string[] args){try{new NativeEngine().Install(Path.GetFullPath(args[0]),s=>Console.WriteLine(s));return 0;}catch(Exception e){Console.Error.WriteLine(e.ToString());return 1;}}
}
