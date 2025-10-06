## 1.8.8

### 新功能 (Feat)
- 升级内核版本
- 增加内核版本选择
- 记住日志页面的筛选关键字
- Webdav增加Cron定时备份
- 连接卡片纯数字显示样式
- 支持修改点击任务栏的窗口触发行为
- 内核设置下增加 WebUI 快捷打开方式

### 修复 (Fix)
- MacOS 首次启动时的 ENOENT: no such file or directory(config.yaml)
- 自动更新获取老的文件名称
- 修复 mihomo.yaml 文件缺失的问题
- Smart 配置文件验证出错的问题
- 开发环境的 electron 问题

### 优化 (Optimize)
- 加快以管理员模式重启速度
- 优化仅用户滚动滚轮时触发自动滚动
- 改进俄语翻译
- 使用重载替换不必要的重启

# 其他 (chore)
 - 更新依赖

### 样式调整 (Sytle)
 - 改进 logo 设计
 - 卡片尺寸
 - 设置页可展开项增加指示图标

## 1.8.7

### 新功能 (Feat)
 - 增加关闭动画开关
 - 增加订阅超时时间设置

### 修复 (Fix)
- 修复 vless 协议 short-id 的解析错误问题
- 修复 MacOS 进入轻量模式内核退出的问题
- 修复 AUR 发布问题
- 修复 改名后升级提示404的问题
- 遗失的部分翻译
- 改名后潜在的 MacOS 安装失败
- 改名后 WinGet 上传失败
- MacOS 首次启动时的 ENOENT: no such file or directory
- 修复 Gist url 404 error
- MacOS 下状态栏图标 Logo

### 优化 (Optimize)
 - socket 管理防止内核通信失败
 - 更加可靠的订阅切换和检查机制

### 样式调整 (Sytle)
 - 改进 logo 设计
 - 改进代理模式的图标
 - 改名后 MacOS 下错误的状态栏图标