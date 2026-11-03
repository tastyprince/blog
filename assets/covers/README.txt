把封面图片放在这个文件夹里。

用法
----
1. 图片命名为英文或拼音，例如 autumn.jpg、bookshelf-01.webp
2. 打开 assets/js/data.js，找到对应文章的 cover 字段，填入路径：

   cover: "assets/covers/autumn.jpg"

3. 保存后刷新页面即可看到；留空 "" 则自动使用 CSS + SVG 装饰封面。

建议
----
- 尺寸：1200 × 900（4:3），文章页会按 16:7.6 的比例裁切显示
- 大小：单张 400KB 以内，优先 WebP
- 风格：暖色、低饱和、少文字，与纸感背景更协调
- 不要把图片放进 assets/css 或 assets/js
