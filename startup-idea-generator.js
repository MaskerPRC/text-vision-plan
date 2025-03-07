const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const API_KEY = 'sk-W0rpStc95T7JVYVwDYc29IyirjtpPPby6SozFMQr17m8KWeo'; // 请填入你的OpenRouter API密钥
const MODEL = 'free:QwQ-32B';
const API_URL = 'https://api.suanli.cn/v1/chat/completions';


// 状态文件路径
const STATE_FILE_PATH = path.join(__dirname, 'state.json');

// 加载状态文件
async function loadState() {
  try {
    const stateExists = await fileExists(STATE_FILE_PATH);
    if (!stateExists) {
      return {
        processedIndustries: {},
        lastUpdated: new Date().toISOString()
      };
    }

    const stateData = await fs.readFile(STATE_FILE_PATH, 'utf8');
    return JSON.parse(stateData);
  } catch (error) {
    console.error('加载状态文件失败:', error.message);
    return {
      processedIndustries: {},
      lastUpdated: new Date().toISOString()
    };
  }
}

// 保存状态文件
async function saveState(state) {
  try {
    state.lastUpdated = new Date().toISOString();
    await fs.writeFile(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf8');
    console.log('状态文件已更新');
  } catch (error) {
    console.error('保存状态文件失败:', error.message);
  }
}

// 检查文件是否存在
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// 查找已生成的创业点子文件
async function findGeneratedIdeaFile(industry, visualType) {
  try {
    const cacheDir = path.join(__dirname, 'cache');
    const files = await fs.readdir(cacheDir);

    const safeIndustryName = industry.replace(/[\/\\:*?"<>|]/g, '_');
    const safeVisualTypeName = visualType.replace(/[\/\\:*?"<>|]/g, '_');

    // 寻找匹配的文件
    const filePattern = new RegExp(`.*-${safeIndustryName}-${safeVisualTypeName}-full.txt$`);
    const matchedFiles = files.filter(file => filePattern.test(file));

    if (matchedFiles.length > 0) {
      // 按创建时间排序，返回最新的
      const filePath = path.join(cacheDir, matchedFiles[matchedFiles.length - 1]);
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    }

    return null;
  } catch (error) {
    console.error(`查找已生成的创业点子失败: ${industry} - ${visualType}:`, error.message);
    return null;
  }
}

// 从缓存文件恢复创业点子
async function recoverIdeaFromCache(industry, visualType) {
  const content = await findGeneratedIdeaFile(industry, visualType);

  if (!content) {
    return null;
  }

  console.log(`从缓存恢复创业点子: ${industry} - ${visualType}`);

  // 从文件内容中提取主要信息
  const { thinking, cleanedText } = extractAndRemoveThinking(content);
  const summary = extractSummary(cleanedText);

  return {
    industry,
    visualType: visualType,
    visualSource: '', // 这个值在后续会被updateVisualSource函数更新
    idea: cleanedText,
    summary: summary || cleanedText.substring(0, 150) + '...', // 如果没有总结，截取前150个字符
    rawResponse: content,
    recovered: true // 标记为从缓存恢复
  };
}

// 更新点子的visualSource信息
function updateVisualSource(idea, visualTypes) {
  const matchedType = visualTypes.find(vt => vt.name === idea.visualType);
  if (matchedType) {
    idea.visualSource = matchedType.source;
  }
  return idea;
}

// 查找已合并的创业方案文件
async function findMergedIdeaFile(industry) {
  try {
    const outputDir = path.join(__dirname, 'output');
    const files = await fs.readdir(outputDir);

    const safeIndustryName = industry.replace(/[\/\\:*?"<>|]/g, '_');

    // 寻找匹配的文件
    const filePattern = new RegExp(`.*-${safeIndustryName}-创业方案.txt$`);
    const matchedFiles = files.filter(file => filePattern.test(file));

    if (matchedFiles.length > 0) {
      // 按创建时间排序，返回最新的
      return path.join(outputDir, matchedFiles[matchedFiles.length - 1]);
    }

    return null;
  } catch (error) {
    console.error(`查找已合并的创业方案失败: ${industry}:`, error.message);
    return null;
  }
}

// 创建优化后的prompt模板
function createPrompt(industry, visualType) {
  return `我想基于gpt-5o强大的图像生成能力创业，直接将"生成高质量图像"作为核心产品或服务。gpt-5o能在30秒内生成高质量图像，具有以下独特优势：

1. 多轮交互式编辑：用户可以通过对话连续修改生成的图片
2. 智能文字渲染：能在图中精准生成中英文文本，适合做海报、标牌等
3. 角色/画面一致性：同一角色在不同场景中保持相貌一致
4. 复合式融合：可将多个元素智能融合到同一画面
5. 低门槛操作：无需复杂提示词或技术配置，对话式界面使普通人也能轻松使用
6. 多模态理解：能同时处理文字指令和图像参考

我想在【${industry}】行业基于【${visualType.name}】(${visualType.source})类型的视觉数据进行创业，直接销售或提供基于gpt-5o生成的图像服务。我倾向于以下两类创业方向（按优先级）：
1. 直接销售gpt-5o生成的高质量图像（如定制图库、按需生成特定图像等）
2. 开发高质量图像的衍生产品（如将生成图像应用于实体产品、数字商品等）

请帮我分析：
1. 在【${industry}】行业，如何直接利用gpt-5o图像生成功能销售图像或图像服务
2. 目标客户群体和他们购买/使用此类图像服务的核心痛点
3. 具体的商业模式和盈利方式（按张收费、会员制、订阅制等）
4. 实施成本评估（重点分析启动资金、人力需求）
5. 预期收益和变现周期（多久能开始盈利）
6. 对比传统图像获取方式的核心竞争优势（生产速度、成本节省等量化指标）
7. 可能面临的挑战（版权、质量一致性等）和解决方案
8. 成功概率和变现能力评分(1-10分)

请优先考虑那些能快速建立的"图像即服务"商业模式，实施成本低、潜在收益高、变现速度快、所需人力少的方案。

最后，请用100字左右总结这个创业点子的核心内容和价值主张，并用<summary>标签包裹，格式如：<summary>总结内容</summary>`;
}

// 从创业点子中提取总结内容
function extractSummary(ideaText) {
  const summaryRegex = /<summary>([\s\S]*?)<\/summary>/i;
  const match = ideaText.match(summaryRegex);
  return match ? match[1].trim() : '';
}

// 从模型输出中提取并移除<think>部分
function extractAndRemoveThinking(text) {
  // 提取<think>...</think>中的内容
  const thinkingRegex = /<think>([\s\S]*?)<\/think>/i;
  const match = text.match(thinkingRegex);
  const thinking = match ? match[1].trim() : '';

  // 移除<think>...</think>部分
  const cleanedText = text.replace(thinkingRegex, '').trim();

  return {
    thinking,
    cleanedText
  };
}

// 生成当前日期时间字符串，格式为YYYY-MM-DD-HH-MM-SS
function getDateTimeString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

// 确保缓存目录存在
async function ensureCacheDir() {
  const cacheDir = path.join(__dirname, 'cache');
  try {
    await fs.mkdir(cacheDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
  return cacheDir;
}

// 保存思考过程到缓存文件
async function saveThinkingToCache(industry, visualType, thinking) {
  if (!thinking) return;

  try {
    const cacheDir = await ensureCacheDir();
    const safeIndustryName = industry.replace(/[\/\\:*?"<>|]/g, '_');
    const safeVisualTypeName = visualType.replace(/[\/\\:*?"<>|]/g, '_');
    const dateTime = getDateTimeString();
    const filename = `${dateTime}-${safeIndustryName}-${safeVisualTypeName}-thinking.txt`;
    const filePath = path.join(cacheDir, filename);

    await fs.writeFile(filePath, thinking, 'utf8');
    console.log(`思考过程已保存到: ${filePath}`);
  } catch (error) {
    console.error('保存思考过程失败:', error.message);
  }
}

// 保存完整API响应到文件
async function saveFullResponseToFile(industry, visualType, response) {
  if (!response) return;

  try {
    const cacheDir = await ensureCacheDir();
    const safeIndustryName = industry.replace(/[\/\\:*?"<>|]/g, '_');
    const safeVisualTypeName = visualType.replace(/[\/\\:*?"<>|]/g, '_');
    const dateTime = getDateTimeString();
    const filename = `${dateTime}-${safeIndustryName}-${safeVisualTypeName}-full.txt`;
    const filePath = path.join(cacheDir, filename);

    await fs.writeFile(filePath, response, 'utf8');
    console.log(`完整响应已保存到: ${filePath}`);
  } catch (error) {
    console.error('保存完整响应失败:', error.message);
  }
}

// 调用OpenRouter API
async function callOpenRouterAPI(prompt, industry = '未分类', visualType = '未指定') {
  try {
    const model = MODEL;
    console.log(`调用API: ${industry} - ${visualType}`);
    const requestConfig = {
      model: model,
      messages: [{ role: 'user', content: prompt }],
    }
    // 根据model值设置provider
    if (model === 'qwen/qwq-32b:free') {
      requestConfig.provider = {
        order: ['Nineteen'],
        allow_fallbacks: false
      };
    } else if (model === 'qwen/qwq-32b') {
      requestConfig.provider = {
        order: ['Groq', 'DeepInfra'],
        allow_fallbacks: false
      };
    }

    const response = await axios.post(
      API_URL,
      {
        ...requestConfig
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const message = response.data.choices[0].message;
    let rawContent = message.content;
    // reasoning 可能在不同属性中，兼容性处理
    message.reasoning = message.reasoning || message.reasoning_content;
    let reasoning = message.reasoning?.trim() || "";

    // 提取 JSON 的辅助方法
    const postProcess = (str) => {
      const info = str.match(/<think>([\s\S]*?)<\/think>([\s\S]*)/);
      if (info) {
        const [_, thinkContent, remainingContent] = info;
        return {
          thinkContent: thinkContent.trim(),
          remainingContent: remainingContent.trim()
        };
      }
      return {
        thinkContent: "",
        remainingContent: str.trim()
      };
    };

    // 如果reasoning没有结构化输出到变量，需要从rawContent提取
    if (!reasoning.length) {
      try {
        const { thinkContent, remainingContent } = postProcess(rawContent);
        reasoning = thinkContent || reasoning;
        rawContent = remainingContent || rawContent;
      } catch (err) {
        console.error('解析模型输出 JSON 失败: ', rawContent);
      }
    }
    rawContent = `<think>${reasoning}</think>${rawContent}`;

    // 保存完整响应
    await saveFullResponseToFile(industry, visualType, rawContent);

    // 提取并移除思考过程
    const { thinking, cleanedText } = extractAndRemoveThinking(rawContent);

    // 保存思考过程
    if (thinking) {
      await saveThinkingToCache(industry, visualType, thinking);
    }

    return {
      rawContent,
      thinking,
      cleanedContent: cleanedText || rawContent // 如果没有<think>标签，返回原始内容
    };
  } catch (error) {
    console.error('API调用失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
    return null;
  }
}

// 为行业分析创业点子
async function analyzeIndustryIdeas(industry, visualTypes, state) {
  console.log(`\n===== 分析【${industry}】行业的创业点子 =====`);

  const ideas = [];

  for (const visualType of visualTypes) {
    // 检查是否已处理过此视觉类型
    const industryState = state.processedIndustries[industry] || {};
    const visualTypeProcessed = industryState[visualType.name];

    if (visualTypeProcessed) {
      console.log(`已处理过 ${visualType.name}，正在尝试从缓存恢复...`);
      const recoveredIdea = await recoverIdeaFromCache(industry, visualType.name);

      if (recoveredIdea) {
        // 更新visualSource信息
        updateVisualSource(recoveredIdea, visualTypes);
        ideas.push(recoveredIdea);
        console.log(`成功从缓存恢复 ${visualType.name} 相关创业点子`);
        console.log(`点子总结: ${recoveredIdea.summary}`);
        continue;
      } else {
        console.log(`未找到缓存，将重新生成 ${visualType.name} 的创业点子`);
      }
    }

    console.log(`正在分析 ${visualType.name} 的创业可能性...`);

    const prompt = createPrompt(industry, visualType);
    const response = await callOpenRouterAPI(prompt, industry, visualType.name);

    if (response) {
      // 保存思考过程
      if (response.thinking) {
        await saveThinkingToCache(industry, visualType.name, response.thinking);
      }

      const summary = extractSummary(response.cleanedContent);

      ideas.push({
        industry,
        visualType: visualType.name,
        visualSource: visualType.source,
        idea: response.cleanedContent,
        summary: summary || response.cleanedContent.substring(0, 150) + '...', // 如果没有总结，截取前150个字符
        rawResponse: response.rawContent // 保存原始响应
      });

      // 更新状态，标记为已处理
      if (!state.processedIndustries[industry]) {
        state.processedIndustries[industry] = {};
      }
      state.processedIndustries[industry][visualType.name] = true;
      await saveState(state);
      if (summary) {
        console.log(`点子总结: ${summary}`);
      } else {
        console.log('未找到点子总结，将使用前150个字符作为摘要');
      }
    }
  }

  // 如果有足够的点子，使用大模型选择最佳的3个
  if (ideas.length > 3) {
    return await selectBestIdeas(industry, ideas, state);
  } else {
    // 如果点子数量不足3个，直接返回所有点子
    return ideas;
  }
}

// 使用大模型选择最佳的3个创业点子
async function selectBestIdeas(industry, ideas, state) {
  // 检查是否已有选择结果
  if (state.processedIndustries[industry] && state.processedIndustries[industry].selectedIdeas) {
    console.log(`\n===== 使用已保存的点子选择结果【${industry}】行业 =====`);
    const selectedIndices = state.processedIndustries[industry].selectedIdeas;

    // 确保索引有效
    const validIndices = selectedIndices.filter(index => index >= 0 && index < ideas.length);
    if (validIndices.length > 0) {
      console.log(`使用已保存的选择: ${validIndices.map(i => i+1).join(', ')}`);
      return validIndices.map(index => ideas[index]);
    }
  }

  console.log(`\n===== 使用大模型评选【${industry}】行业的最佳创业点子 =====`);

  // 创建每个点子的摘要
  const ideasSummary = ideas.map((idea, index) => {
    return `创业点子${index + 1}：基于【${idea.visualType}】(${idea.visualSource})
总结: ${idea.summary}`;
  }).join('\n\n');

  const prompt = `以下是基于gpt-5o图像生成能力在【${industry}】行业的多个创业点子:

${ideasSummary}

作为创业投资专家，请评估上述创业点子，选出其中最具商业价值和可行性的3个点子，尤其是那些直接将"图像销售/服务"作为核心业务的点子。
请按以下优先顺序评估创业点子：

1. 直接销售图像产品 - 优先选择直接销售gpt-5o生成的高质量图像的点子（如定制图库、按需图像生成服务等）
2. 图像衍生产品 - 其次考虑将生成图像应用于实体或数字产品的点子
3. 实施成本低 - 启动和运营所需资金小
4. 明确的收费模式 - 有清晰的定价策略和收费方式
5. 潜在收益高 - 利润空间大、市场规模可观
6. 快速变现 - 能在短时间内产生收入
7. 人力投入少 - 不需要大量人力资源

请明确列出你选择的3个点子编号(创业点子X)，并简要说明每个点子如何直接利用gpt-5o的图像生成能力进行商业化。尤其关注如何将生成的图像直接变现。回复格式如下：
选择的点子: [点子编号1, 点子编号2, 点子编号3]
选择理由: 
- 点子X: [如何直接销售/变现生成图像，价格策略，目标客户]
- 点子Y: [如何直接销售/变现生成图像，价格策略，目标客户]
- 点子Z: [如何直接销售/变现生成图像，价格策略，目标客户]`;

  console.log('正在评估创业点子，优先选择直接销售图像产品/服务的点子...');
  const response = await callOpenRouterAPI(prompt, industry, '选择最佳点子');

  // 保存思考过程
  if (response.thinking) {
    await saveThinkingToCache(industry, '选择最佳点子', response.thinking);
  }

  // 解析响应，提取选择的点子编号
  const selectionRegex = /选择的点子:\s*\[?\s*(\d+)[,，\s]+(\d+)[,，\s]+(\d+)\s*\]?/i;
  const match = response.cleanedContent.match(selectionRegex);

  if (match && match.length >= 4) {
    const selectedIndices = [
      parseInt(match[1], 10) - 1,
      parseInt(match[2], 10) - 1,
      parseInt(match[3], 10) - 1
    ].filter(index => index >= 0 && index < ideas.length);

    console.log(`大模型已选择点子编号: ${selectedIndices.map(i => i+1).join(', ')}`);
    console.log('选择标准: 直接销售图像产品/服务、图像衍生产品、低成本、快速变现');

    // 更新状态，保存选择结果
    if (!state.processedIndustries[industry]) {
      state.processedIndustries[industry] = {};
    }
    state.processedIndustries[industry].selectedIdeas = selectedIndices;
    await saveState(state);

    // 返回选中的点子
    return selectedIndices.map(index => ideas[index]);
  } else {
    return ideas.slice(0, 3);
  }
}

// 合并某行业的最佳点子
async function combineIndustryTopIdeas(industry, topIdeas) {
  const ideasSummary = topIdeas.map((idea, index) =>
    `创业点子${index + 1}：\n视觉类型：${idea.visualType}\n${idea.idea}`
  ).join('\n\n---\n\n');

  const prompt = `以下是【${industry}】行业基于gpt-5o图像生成能力的三个创业点子：
  
${ideasSummary}

请分析以上三个创业点子的优缺点，并将它们合并为一个更完整、更具可行性的【${industry}】行业创业方案。这个方案应该直接将"图像销售/服务"作为核心业务，充分利用gpt-5o图像生成的核心优势：30秒生成高质量图像、多轮交互式编辑、智能文字渲染、角色画面一致性等。

在合并时，请重点考虑以下两类核心业务模式（按优先级）：
1. 直接销售gpt-5o生成的高质量图像（如定制图库、按需生成特定图像等）
2. 开发高质量图像的衍生产品（如将生成图像应用于实体产品、数字商品等）

并优先考虑以下特性：
1. 实施成本低 - 尽量降低启动和运营所需资金
2. 潜在收益高 - 确保有良好的利润空间和市场规模
3. 快速变现 - 能在短时间内开始产生收入
4. 人力投入少 - 减少对大量人力资源的依赖
5. 明确的收费模式 - 如按图收费、会员制、订阅制等

请详细说明：
1. 合并后的创业概念和明确定位（重点突出"图像产品/服务"业务模式）
2. 目标客户群体和他们愿意为此类图像服务付费的原因
3. 具体的商业模式和价格策略（如何定价、收费机制等）
4. 实施步骤和资源需求（特别是启动成本和人力需求）
5. 预期的收益和变现周期（多久能开始盈利）
6. 相比传统图像获取方式的核心竞争优势（速度提升、成本节省等量化指标）
7. 可能面临的挑战（版权问题、质量稳定性等）和应对策略`;

  console.log(`\n===== 正在合并【${industry}】行业的最佳创业点子 =====`);

  const response = await callOpenRouterAPI(prompt, industry, '合并点子');

  if (response && response.thinking) {
    await saveThinkingToCache(industry, '合并点子', response.thinking);
  }

  return response ? response.cleanedContent : null;
}

// 创建输出目录
async function ensureOutputDir() {
  const outputDir = path.join(__dirname, 'output');
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
  return outputDir;
}


// 处理单个行业
async function processIndustry(industry, configPath, state) {
  // 输出文件名（使用合法的文件名）
  const outputDir = await ensureOutputDir();
  try {
    console.log(`\n========== 开始处理【${industry}】行业 ==========`);

    // 检查是否已处理过此行业
    if (state.processedIndustries[industry] && state.processedIndustries[industry].completed) {
      console.log(`【${industry}】行业已处理完成，正在从文件恢复...`);

      // 查找已合并的创业方案文件
      const mergedFilePath = await findMergedIdeaFile(industry);

      if (mergedFilePath) {
        console.log(`已找到现有创业方案文件: ${mergedFilePath}`);

        // 从文件中读取内容，重建结果对象
        const fileContent = await fs.readFile(mergedFilePath, 'utf8');

        // 从文件内容中提取点子信息
        const ideasRegex = /## 创业点子 (\d+)：(.*?)\n总结: (.*?)\n评分: (\d+)\/10\n\n([\s\S]*?)(?=\n\n---|$)/g;
        const finalIdeaRegex = /===== 最终合并创业方案 =====\n\n([\s\S]*)/;

        const topIdeas = [];
        let match;
        while ((match = ideasRegex.exec(fileContent)) !== null) {
          topIdeas.push({
            industry,
            visualType: match[2].trim(),
            summary: match[3].trim(),
            idea: match[5].trim(),
            recovered: true
          });
        }

        const finalIdeaMatch = fileContent.match(finalIdeaRegex);
        const finalIdea = finalIdeaMatch ? finalIdeaMatch[1] : '';

        // 构建结果对象
        return {
          industry,
          topIdeas,
          finalIdea,
          recovered: true
        };
      } else {
        console.log(`未找到已合并的创业方案文件，将重新处理【${industry}】行业`);
        // 重置已完成标记
        state.processedIndustries[industry].completed = false;
        await saveState(state);
      }
    }

    // 读取JSON配置文件
    const data = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(data);

    // 提取视觉类型信息
    const visualTypes = config.filter(item => item.visual === true);

    if (visualTypes.length === 0) {
      console.log(`【${industry}】行业没有视觉类型信息，跳过`);
      return null;
    }

    // 分析此行业的创业点子
    const topIdeas = await analyzeIndustryIdeas(industry, visualTypes, state);

    if (topIdeas.length === 0) {
      console.log(`【${industry}】行业未能生成有效的创业点子，跳过`);
      return null;
    }

    console.log(`\n【${industry}】行业的前3个创业点子：`);
    topIdeas.forEach((idea, index) => {
      console.log(`#${index + 1}: ${idea.visualType}`);
      console.log(`总结: ${idea.summary.substring(0, 100)}...`);
    });

    // 检查是否已有合并结果
    let finalIdea = null;
    if (state.processedIndustries[industry] && state.processedIndustries[industry].merged) {
      console.log(`检查${industry}行业的合并点子缓存...`);
      const mergedFilePath = await findMergedIdeaFile(industry);

      if (mergedFilePath) {
        // 从文件中提取最终合并的创业方案
        const fileContent = await fs.readFile(mergedFilePath, 'utf8');
        const finalIdeaRegex = /===== 最终合并创业方案 =====\n\n([\s\S]*)/;
        const finalIdeaMatch = fileContent.match(finalIdeaRegex);

        if (finalIdeaMatch) {
          finalIdea = finalIdeaMatch[1];
          console.log(`从缓存恢复合并的创业方案`);
        }
      }
    }

    // 如果没有找到缓存的合并结果，重新合并
    if (!finalIdea) {
      finalIdea = await combineIndustryTopIdeas(industry, topIdeas);

      // 更新状态，标记为已合并
      if (!state.processedIndustries[industry]) {
        state.processedIndustries[industry] = {};
      }
      state.processedIndustries[industry].merged = true;
      await saveState(state);
    }

    // 准备结果
    const result = {
      industry,
      topIdeas,
      finalIdea
    };

    const safeIndustryName = industry.replace(/[\/\\:*?"<>|]/g, '_');
    const dateTime = getDateTimeString();
    const outputPath = path.join(outputDir, `${dateTime}-${safeIndustryName}-创业方案.txt`);

    // 保存结果到文件
    const outputContent = `【${industry}】行业创业方案\n\n` +
      `===== 基于gpt-5o图像生成能力的创业点子 =====\n\n` +
      topIdeas.map((idea, index) =>
        `## 创业点子 ${index + 1}：${idea.visualType}\n` +
        `总结: ${idea.summary}\n` +
        `${idea.idea}`
      ).join('\n\n---\n\n') +
      `\n\n===== 最终合并创业方案 =====\n\n${finalIdea}`;

    await fs.writeFile(outputPath, outputContent, 'utf8');
    console.log(`【${industry}】行业创业方案已保存到 ${outputPath}`);

    // 标记为已完成
    if (!state.processedIndustries[industry]) {
      state.processedIndustries[industry] = {};
    }
    state.processedIndustries[industry].completed = true;
    await saveState(state);

    return result;
  } catch (error) {
    console.error(`处理【${industry}】行业时出错:`, error.message);
    return null;
  }
}

// 主函数
async function main() {
  // 输出文件名（使用合法的文件名）
  const outputDir = await ensureOutputDir();
  try {
    // 检查API密钥
    if (!API_KEY) {
      console.log('请在脚本中设置你的OpenRouter API密钥');
      return;
    }

    // 加载状态
    const state = await loadState();
    console.log(`加载状态文件，上次更新时间: ${state.lastUpdated}`);

    // 获取所有行业目录
    const assertDir = path.join(__dirname, 'assert');
    const industries = (await fs.readdir(assertDir, { withFileTypes: true }))
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    console.log(`找到${industries.length}个行业目录`);

    // 创建摘要文件
    const summaryContent = [];
    summaryContent.push('# 行业创业方案摘要');
    summaryContent.push('');
    summaryContent.push('本文件包含基于gpt-5o图像生成能力的各行业创业方案摘要。');
    summaryContent.push(`生成时间: ${new Date().toLocaleString()}`);
    summaryContent.push('');

    // 处理所有行业
    let successCount = 0;
    for (const industry of industries) {
      const configPath = path.join(assertDir, industry, 'config.json');

      // 检查配置文件是否存在
      try {
        await fs.access(configPath);
      } catch (error) {
        console.log(`【${industry}】行业没有配置文件，跳过`);
        continue;
      }

      // 处理此行业
      const result = await processIndustry(industry, configPath, state);

      if (result) {
        successCount++;
        summaryContent.push(`## ${industry}`);
        summaryContent.push('');
        summaryContent.push('创业点子：');
        result.topIdeas.forEach((idea, index) => {
          summaryContent.push(`- 点子${index + 1}: ${idea.visualType}`);
          summaryContent.push(`  总结: ${idea.summary.length > 150 ? idea.summary.substring(0, 150) + '...' : idea.summary}`);
        });
        summaryContent.push('');

        // 提取最终方案的简短摘要 - 最终方案不再有<summary>标签
        const summary = result.finalIdea.split('\n').slice(0, 3).join('\n') + '...';
        summaryContent.push(`最终方案摘要: ${summary}`);
        summaryContent.push('');

        // 获取最新的创业方案文件
        const mergedFilePath = await findMergedIdeaFile(industry);
        if (mergedFilePath) {
          const relativePath = path.relative(outputDir, mergedFilePath).replace(/\\/g, '/');
          summaryContent.push(`详细方案见: ${relativePath}`);
        } else {
          // 如果没有找到文件，使用预计的文件名
          const dateTime = getDateTimeString();
          const safeIndustryName = industry.replace(/[\/\\:*?"<>|]/g, '_');
          summaryContent.push(`详细方案见: output/${dateTime}-${safeIndustryName}-创业方案.txt`);
        }
        summaryContent.push('');
      }
    }

    const dateTime = getDateTimeString();
    const summaryPath = path.join(outputDir, `${dateTime}-行业创业方案摘要.md`);
    await fs.writeFile(summaryPath, summaryContent.join('\n'), 'utf8');

    console.log(`\n处理完成! 成功生成 ${successCount} 个行业的创业方案。`);
    console.log(`摘要文件已保存到 ${summaryPath}`);
    console.log(`所有创业方案已保存到 output/ 目录`);
    console.log(`所有API响应和思考过程已保存到 cache/ 目录，以日期时间命名`);

  } catch (error) {
    console.error('程序执行出错:', error);
  }
}

// 运行主函数
main();
