# 第二台电脑接入协作总线（中文说明）

这个文件由 AUTO_SETUP.bat 自动打开，给你看清楚接下来怎么做。
命令行窗口里的英文是给机器看的，不用管它。

## 已经自动帮你做完的事
1. 代码已下载到本机（路径窗口里显示了，一般是 C:\Users\你的用户名\Allsoft.asia）
2. 本机代号（device 名）已按电脑名自动生成，写进了 .workbuddy/memory/DEVICE
3. 已向协作总线报“上线”，第一台电脑能看到你了

## 你接下来只做一步
打开本机（这台电脑）的 WorkBuddy，对它说一句话：

> 读 .workbuddy/memory/SYNC.md，接入协作总线开始干活

说完它就会自己读规则、拉任务、和另一台一起干活了。

## 想看两台在干嘛
浏览器打开 https://allsoft.asia/team ，随时看在线状态、任务板、互相发的消息。

## 如果命令行窗口报错
- 提示 git failed：本机没装 git，或没联网。装 git：https://git-scm.com/download/win
- 提示 python not found：没装 Python。装的时候勾选 “Add Python to PATH”
- 详细错误在 setup.log 文件里，不懂就截图发给我
