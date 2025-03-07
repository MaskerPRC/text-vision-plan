const fs = require('fs');
const path = require('path');
const { mdimg } = require('mdimg');

// 创建images目录（如果不存在）
const imagesDir = path.join(__dirname, 'text_images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// 遍历cache目录
const cacheDir = path.join(__dirname, 'text_output');
const files = fs.readdirSync(cacheDir);

// 筛选包含"-full"的文件
const targetFiles = files.filter(file => file.includes('-文本创业方案.txt'));

// 转换进度计数
let processedCount = 0;
let skippedCount = 0;

// 自定义HTML模板
const customHtmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* 自定义样式覆盖默认样式 */
    .markdown-body {
      box-sizing: border-box;
      min-width: 200px;
      max-width: 980px;
      margin: 0 auto;
      padding: 30px 50px;
      border-radius: 8px;
      background-color: #fff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji";
    }
    
    .markdown-body h1, .markdown-body h2 {
      padding-bottom: 0.3em;
      border-bottom: 1px solid #eaecef;
      color: #0366d6;
    }
    
    .markdown-body h3, .markdown-body h4 {
      color: #24292e;
    }
    
    .markdown-body blockquote {
      padding: 0 1em;
      color: #1b1f23;
      border-left: 0.25em solid #0366d6;
      background-color: #f6f8fa;
      border-radius: 3px;
    }
    
    .markdown-body table {
      border-spacing: 0;
      border-collapse: collapse;
      width: 100%;
      overflow: auto;
    }
    
    .markdown-body table th {
      font-weight: 600;
      background-color: #f6f8fa;
    }
    
    .markdown-body table tr {
      background-color: #fff;
      border-top: 1px solid #c6cbd1;
    }
    
    .markdown-body table tr:nth-child(2n) {
      background-color: #f6f8fa;
    }
    
    .markdown-body table td, .markdown-body table th {
      padding: 6px 13px;
      border: 1px solid #dfe2e5;
    }
    
    .markdown-body code {
      padding: 0.2em 0.4em;
      margin: 0;
      font-size: 85%;
      background-color: #f6f8fa;
      border-radius: 3px;
    }
    
    .markdown-body .highlight pre, .markdown-body pre {
      padding: 16px;
      overflow: auto;
      font-size: 85%;
      line-height: 1.45;
      background-color: #f6f8fa;
      border-radius: 6px;
    }
    
    /* 添加页眉样式 */
    .header {
      text-align: center;
      margin-bottom: 20px;
      color: #586069;
      font-size: 14px;
      border-bottom: 1px solid #eaecef;
      padding-bottom: 10px;
    }
    
    /* 添加页脚样式 */
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #586069;
      font-size: 14px;
      border-top: 1px solid #eaecef;
      padding-top: 10px;
    }
  </style>
</head>
<body>
  <div id="mdimg-body">
    <div class="header">AI创业点子生成器 - 最佳创业方案</div>
    <div class="markdown-body"></div>
    <div class="footer">© ${new Date().getFullYear()} 创业方案智能生成</div>
  </div>
</body>
</html>
`;

// 异步处理每个文件
async function processFiles() {
  console.log(`找到 ${targetFiles.length} 个合并点子文件，开始处理...`);

  for (const file of targetFiles) {
    const filePath = path.join(cacheDir, file);

    // 创建输出文件名（基于原始文件名但没有扩展名）
    const baseName = path.basename(file, path.extname(file));
    const outputPath = path.join(imagesDir, `${baseName}.png`);

    // 检查图片是否已存在
    if (fs.existsSync(outputPath)) {
      console.log(`⏩ 跳过已存在的图片: ${outputPath}`);
      skippedCount++;
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // 提取</think>后面的markdown内容
    const match = content.match(/([\s\S]*)<summary>/);
    if (match && match[1]) {
      let markdownContent = match[1].trim();

      try {
        // 将markdown转换为图片
        const result = await mdimg({
          inputText: markdownContent,
          outputFilename: outputPath,
          width: 900, // 增加宽度
          pixel: 1.5, // 提高分辨率
          html: customHtmlTemplate, // 使用自定义HTML模板
          screenshot: {
            type: 'png', // 指定输出格式
            quality: 100, // 最高质量
            fullPage: true, // 捕获完整页面
            omitBackground: false, // 保留背景
            clip: { // 裁剪到内容区域
              padding: 40
            }
          },
          css: {
            mediaPrint: true // 启用打印媒体样式
          },
          theme: 'light', // 使用亮色主题
          timeout: 60000, // 超时时间增加到60秒
        });

        console.log(`✅ 已生成图片: ${outputPath}`);
        processedCount++;
      } catch (error) {
        console.error(`❌ 处理文件 ${file} 时出错:`, error);
      }
    } else {
      console.warn(`⚠️ 文件 ${file} 中没有找到 </think> 标记`);
    }
  }

  console.log(`\n处理完成! 共转换 ${processedCount}/${targetFiles.length} 个文件，跳过 ${skippedCount} 个已存在的文件`);
}

// 执行转换过程
processFiles().catch(err => {
  console.error('程序执行失败:', err);
  process.exit(1);
});
