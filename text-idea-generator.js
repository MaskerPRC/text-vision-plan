const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const API_KEY = 'sk-W0rpStc95T7JVYVwDYc29IyirjtpPPby6SozFMQr17m8KWeo'; // 请填入你的OpenRouter API密钥
const MODEL = 'free:QwQ-32B';
const API_URL = 'https://api.suanli.cn/v1/chat/completions';


// 状态文件路径
const STATE_FILE_PATH = path.join(__dirname, 'text_state.json');

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
async function findGeneratedIdeaFile(industry, textType) {
  try {
    const cacheDir = path.join(__dirname, 'text_cache');
    const files = await fs.readdir(cacheDir);

    const safeIndustryName = industry.replace(/[\/\\:*?"<>|]/g, '_');
    const safeTextTypeName = textType.replace(/[\/\\:*?"<>|]/g, '_');

    // 寻找匹配的文件
    const filePattern = new RegExp(`.*-${safeIndustryName}-${safeTextTypeName}-full.txt$`);
    const matchedFiles = files.filter(file => filePattern.test(file));

    if (matchedFiles.length > 0) {
      // 按创建时间排序，返回最新的
      const filePath = path.join(cacheDir, matchedFiles[matchedFiles.length - 1]);
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    }

    return null;
  } catch (error) {
    console.error(`查找已生成的创业点子失败: ${industry} - ${textType}:`, error.message);
    return null;
  }
}

// 从缓存文件恢复创业点子
async function recoverIdeaFromCache(industry, textType) {
  const content = await findGeneratedIdeaFile(industry, textType);

  if (!content) {
    return null;
  }

  console.log(`从缓存恢复创业点子: ${industry} - ${textType}`);

  // 从文件内容中提取主要信息
  const { thinking, cleanedText } = extractAndRemoveThinking(content);
  const summary = extractSummary(cleanedText);

  return {
    industry,
    textType: textType,
    textSource: '', // 这个值在后续会被updateTextSource函数更新
    idea: cleanedText,
    summary: summary || cleanedText.substring(0, 150) + '...', // 如果没有总结，截取前150个字符
    rawResponse: content,
    recovered: true // 标记为从缓存恢复
  };
}

// 更新点子的textSource信息
function updateTextSource(idea, textTypes) {
  const matchedType = textTypes.find(tt => tt.name === idea.textType);
  if (matchedType) {
    idea.textSource = matchedType.source;
  }
  return idea;
}

// 查找已合并的创业方案文件
async function findMergedIdeaFile(industry) {
  try {
    const outputDir = path.join(__dirname, 'text_output');
    const files = await fs.readdir(outputDir);

    const safeIndustryName = industry.replace(/[\/\\:*?"<>|]/g, '_');

    // 寻找匹配的文件
    const filePattern = new RegExp(`.*-${safeIndustryName}-文本创业方案.txt$`);
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
function createPrompt(industry, textType) {
  return `我想基于gpt-5o自然语言处理能力创业，直接将"高质量文本生成和分析"作为核心产品或服务。绝对要求：成本低于1000人民币
gpt-5o能在几秒内生成和处理高质量文本，具有以下独特优势：

1. 多轮交互式写作：用户可以通过对话连续优化生成的文本
2. 多语言支持：能精准处理和生成多种语言的文本内容
3. 风格和语调一致性：能在不同场景中保持特定的写作风格和语调
4. 上下文理解：能理解长文本上下文，生成连贯性强的内容
5. 低门槛操作：无需复杂提示词或技术配置，对话式界面使普通人也能轻松使用
6. 专业内容生成：能生成包含专业术语和行业知识的高质量内容
7. 最优长度控制：生成模型在2000字以内的文本质量最高，超过后质量可能下降

我想在【${industry}】行业基于【${textType.name}】(${textType.source})类型的文本数据进行创业，直接销售或提供基于gpt-5o生成的文本服务。我倾向于以下两类创业方向（按优先级）：
1. 直接销售gpt-5o生成的高质量文本内容（如定制内容、按需生成特定文档等）
2. 开发高质量文本的衍生服务（如将生成文本应用于培训、决策支持、客户服务等）

请仅仅以以下三个部分简明扼要地回答，回答总字数尽量控制在2000字以内：

# 1. 创业点子介绍（200字以内）
简述利用gpt-5o在${industry}行业中基于${textType.name}文本生成的核心创业方案，包括产品/服务定义、目标客户和核心价值主张。

# 2. 可行性分析（200字以内）
分析该点子的可行性，包括：
- 预估启动资金：具体金额
- 预估人力需求：具体人数和角色
- 预期变现周期：多久能开始盈利
- 传统人工创作此类文本的平均成本：具体金额/时间
- 使用AI生成的成本节省比例：百分比
- 传统方法与AI方法的成本差异评分（1-10分，10分表示差异极大）
- 该文本类型的典型长度是否在2000字以内（是/否）

# 3. MVP(最小可行产品)5天实施方案（200字以内）
列出5天内可以实现的最小可行产品方案，包括具体任务安排和资源需求。

最后，请用50字左右总结这个创业点子的核心内容和价值主张，并用<summary>标签包裹，格式如：<summary>总结内容</summary>`;
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
async function ensureTextCacheDir() {
  const cacheDir = path.join(__dirname, 'text_cache');
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
async function saveThinkingToCache(industry, textType, thinking) {
  if (!thinking) return;

  try {
    const cacheDir = await ensureTextCacheDir();
    const safeIndustryName = industry.replace(/[\/\\:*?"<>|]/g, '_');
    const safeTextTypeName = textType.replace(/[\/\\:*?"<>|]/g, '_');
    const dateTime = getDateTimeString();
    const filename = `${dateTime}-${safeIndustryName}-${safeTextTypeName}-thinking.txt`;
    const filePath = path.join(cacheDir, filename);

    await fs.writeFile(filePath, thinking, 'utf8');
    console.log(`思考过程已保存到: ${filePath}`);
  } catch (error) {
    console.error('保存思考过程失败:', error.message);
  }
}

// 保存完整API响应到文件
async function saveFullResponseToFile(industry, textType, response) {
  if (!response) return;

  try {
    const cacheDir = await ensureTextCacheDir();
    const safeIndustryName = industry.replace(/[\/\\:*?"<>|]/g, '_');
    const safeTextTypeName = textType.replace(/[\/\\:*?"<>|]/g, '_');
    const dateTime = getDateTimeString();
    const filename = `${dateTime}-${safeIndustryName}-${safeTextTypeName}-full.txt`;
    const filePath = path.join(cacheDir, filename);

    await fs.writeFile(filePath, response, 'utf8');
    console.log(`完整响应已保存到: ${filePath}`);

    return filePath;
  } catch (error) {
    console.error('保存完整响应失败:', error.message);
    return null;
  }
}

// 调用API获取创业点子
async function callOpenRouterAPI(prompt, industry = '未分类', textType = '未指定') {
  try {
    console.log(`开始生成创业点子: ${industry} - ${textType}`);

    const response = await axios.post(API_URL, {
      model: MODEL,
      messages: [
        { role: "system", content: "你是一位创新创业顾问，擅长发现文本数据的商业价值，分析市场机会，设计可行的创业方案。" },
        { role: "user", content: prompt }
      ],
      max_tokens: 3500
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    console.log(`创业点子生成完成: ${industry} - ${textType}`);

    if (response.data && response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    } else {
      throw new Error('API返回格式错误');
    }
  } catch (error) {
    console.error(`API调用失败 (${industry} - ${textType}):`, error.message);

    // 如果是账户余额不足，切换到免费模型
    if (error.response && error.response.status === 402) {
      console.log('尝试切换到免费模型...');
      MODEL = 'free:QwQ-32B';
      const API_URL = 'https://api.suanli.cn/v1/chat/completions';
      // 重试一次
      return callOpenRouterAPI(prompt, industry, textType);
    }

    throw error;
  }
}

// 为行业分析创业点子
async function analyzeIndustryIdeas(industry, textTypes, state) {
  const ideas = [];

  console.log(`\n==== 开始分析 ${industry} 行业的文本类型创业点子 ====`);

  // 对textTypes按size倒序排序
  const sortedTextTypes = [...textTypes].sort((a, b) => (b.size || 0) - (a.size || 0));

  for (const textType of sortedTextTypes) {
    try {
      // 检查是否已处理过该文本类型
      const industryState = state.processedIndustries[industry] || {};
      const processedTextTypes = industryState.processedTextTypes || {};

      // 尝试从缓存恢复
      let idea = null;
      if (processedTextTypes[textType.name]) {
        idea = await recoverIdeaFromCache(industry, textType.name);
      }

      if (!idea) {
        const prompt = createPrompt(industry, textType);
        const response = await callOpenRouterAPI(prompt, industry, textType.name);

        const { thinking, cleanedText } = extractAndRemoveThinking(response);
        await saveThinkingToCache(industry, textType.name, thinking);
        await saveFullResponseToFile(industry, textType.name, response);

        const summary = extractSummary(cleanedText);

        idea = {
          industry,
          textType: textType.name,
          textSource: textType.source,
          idea: cleanedText,
          summary: summary || cleanedText.substring(0, 150) + '...', // 如果没有总结，截取前150个字符
          rawResponse: response
        };

        // 更新状态
        industryState.processedTextTypes = processedTextTypes;
        industryState.processedTextTypes[textType.name] = true;
        state.processedIndustries[industry] = industryState;
        await saveState(state);
      }

      ideas.push(idea);
      console.log(`✓ ${textType.name} 创业点子已生成`);
    } catch (error) {
      console.error(`生成 ${industry} - ${textType.name} 创业点子失败:`, error.message);
    }
  }

  return ideas;
}

// 选择最好的创业点子
async function selectBestIdeas(industry, ideas, state) {
  if (ideas.length === 0) {
    return [];
  }

  console.log(`\n==== 选择 ${industry} 行业最佳文本创业点子 ====`);

  try {
    // 检查是否已经评估过
    const industryState = state.processedIndustries[industry] || {};

    if (industryState.evaluatedTextIdeas) {
      console.log(`从状态恢复已评估的创业点子...`);

      // 如果已评估，尝试恢复评估结果
      if (industryState.bestTextIdeas && industryState.bestTextIdeas.length > 0) {
        console.log(`已从状态恢复最佳创业点子`);
        return industryState.bestTextIdeas;
      }
    }

    // 如果ideas数量少于3个，直接返回全部
    if (ideas.length <= 3) {
      console.log(`创业点子数量(${ideas.length})少于3个，全部返回`);
      industryState.evaluatedTextIdeas = true;
      industryState.bestTextIdeas = ideas;
      state.processedIndustries[industry] = industryState;
      await saveState(state);
      return ideas;
    }

    console.log(`评估 ${ideas.length} 个创业点子...`);

    // 创建评估prompt
    const summaries = ideas.map((idea, index) =>
      `创业点子 ${index + 1}：[${idea.textType}] ${idea.summary}`
    ).join('\n\n');

    const evaluationPrompt = `我有以下 ${industry} 行业基于文本数据的创业点子，请帮我评估并选出最有潜力的3个点子。
评估标准(按重要性排序):
1. 人工成本差异：传统人工创作此类文本与AI生成的成本差异，差异越大排名越高
2. 文本长度适中：优先考虑能在2000字以内生成高质量内容的文本类型，因为生成模型在这个长度范围内表现最佳
3. 实施难度低：启动资金低、技术门槛低、团队规模小
4. 盈利潜力高：利润率高、市场规模大、变现周期短
5. 竞争壁垒强：有差异化优势、不易被复制、有护城河
6. 风险水平低：法律合规、市场接受度高、不确定性小

请特别注意：人工成本差异和文本长度适中是最重要的评估因素。如果某个文本类型在传统方式下生成成本极高（如需要大量专业人员、长时间创作、高度专业知识），而用AI可以大幅降低成本（降低90%以上），同时该文本类型的内容通常在2000字以内就能表达完整，则该点子应获得最高优先级。

以下是创业点子摘要：
${summaries}

请按照上述评估标准，分析每个点子的优缺点，特别关注传统人工创作与AI生成的成本差异以及文本长度是否适中。然后选出最有潜力的3个创业点子（用序号表示，如#1、#2、#3）。对于每个选择，请简要说明选择理由，尤其是人工成本差异和文本长度方面的考量。`;

    console.log('正在进行评估...');
    const evaluationResponse = await callOpenRouterAPI(evaluationPrompt, industry, '创业点子评估');

    // 从评估结果中提取选中的点子编号
    const selectedIndices = [];
    const numberRegex = /创业点子\s*(\d+)|点子\s*(\d+)|#\s*(\d+)/g;
    let match;

    while ((match = numberRegex.exec(evaluationResponse)) !== null) {
      const index = parseInt(match[1] || match[2] || match[3], 10) - 1; // 减1是因为数组索引从0开始
      if (!isNaN(index) && index >= 0 && index < ideas.length && !selectedIndices.includes(index)) {
        selectedIndices.push(index);
        if (selectedIndices.length >= 3) break; // 最多选3个
      }
    }

    // 如果没有正确提取出编号，默认取前3个
    if (selectedIndices.length === 0) {
      console.log('无法从评估结果中提取明确的选择，默认选择前3个创业点子');
      for (let i = 0; i < Math.min(3, ideas.length); i++) {
        selectedIndices.push(i);
      }
    }

    // 获取选中的创业点子
    const bestIdeas = selectedIndices.map(index => ideas[index]);
    console.log(`已选择 ${bestIdeas.length} 个最佳创业点子: ${bestIdeas.map(idea => idea.textType).join(', ')}`);

    // 更新状态
    industryState.evaluatedTextIdeas = true;
    industryState.bestTextIdeas = bestIdeas;
    state.processedIndustries[industry] = industryState;
    await saveState(state);

    return bestIdeas;
  } catch (error) {
    console.error(`选择最佳创业点子失败:`, error.message);
    // 出错时，如果有点子就返回前3个，否则返回空数组
    return ideas.slice(0, 3);
  }
}

// 合并行业最佳创业点子
async function combineIndustryTopIdeas(industry, topIdeas) {
  if (topIdeas.length === 0) {
    return null;
  }

  console.log(`\n==== 合并 ${industry} 行业最佳文本创业点子 ====`);

  try {
    // 查找现有的合并文件
    const existingMergedFile = await findMergedIdeaFile(industry);
    if (existingMergedFile) {
      console.log(`发现已合并的创业方案: ${existingMergedFile}`);
      const content = await fs.readFile(existingMergedFile, 'utf8');
      return content;
    }

    // 准备合并提示
    const ideasContext = topIdeas.map((idea, index) =>
      `创业点子 ${index + 1} [${idea.textType}]:
${idea.idea}
---`
    ).join('\n\n');

    const mergePrompt = `我想在【${industry}】行业基于文本数据开展创业。以下是我已经构思的几个创业点子：

${ideasContext}

请帮我将这些创业点子整合成一个更全面、更具可行性的创业方案。请以以下三个部分进行简明扼要的回答，回答总字数控制在2000字以内（这是非常重要的，因为模型在2000字以内的文本质量最高）：

# 1. 整合创业方案介绍（300字以内）
融合以上点子，简述一个完整的创业方案，包括产品/服务定义、目标客户和核心价值主张。

# 2. 综合可行性分析（300字以内）
- 预估启动资金：具体金额
- 预估人力需求：具体人数和角色
- 预期变现周期：多久能开始盈利
- 传统人工创作相关文本的平均成本：具体金额/时间
- 使用AI生成的成本节省比例：百分比
- 传统方法与AI方法的成本差异评分（1-10分，10分表示差异极大）
- 最终产品/服务是否能在2000字以内的文本范围内提供完整价值（是/否）

# 3. 整合MVP(最小可行产品)7天实施方案（300字以内）
列出7天内可以实现的最小可行产品方案，包括具体任务安排和资源需求。

最后，请用100字左右总结这个完整的创业方案，并用<summary>标签包裹，格式如：<summary>总结内容</summary>`;

    // 调用API合并创业点子
    console.log('正在合并创业点子...');
    const mergedResponse = await callOpenRouterAPI(mergePrompt, industry, '合并创业方案');

    // 保存合并结果
    const outputDir = await ensureTextOutputDir();
    const safeIndustryName = industry.replace(/[\/\\:*?"<>|]/g, '_');
    const dateTime = getDateTimeString();
    const filename = `${dateTime}-${safeIndustryName}-文本创业方案.txt`;
    const filePath = path.join(outputDir, filename);

    await fs.writeFile(filePath, mergedResponse, 'utf8');
    console.log(`合并的创业方案已保存到: ${filePath}`);

    return mergedResponse;
  } catch (error) {
    console.error(`合并创业点子失败:`, error.message);
    return null;
  }
}

// 确保输出目录存在
async function ensureTextOutputDir() {
  const outputDir = path.join(__dirname, 'text_output');
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
  return outputDir;
}

// 主函数
async function main() {
  console.log('基于文本信息的创业点子生成器启动...');

  try {
    // 解析命令行参数
    const args = process.argv.slice(2);
    let targetIndustry = null;
    let textTypeLimit = null;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--industry' && i + 1 < args.length) {
        targetIndustry = args[i + 1];
        i++;
      } else if (args[i] === '--limit' && i + 1 < args.length) {
        textTypeLimit = parseInt(args[i + 1], 10);
        if (isNaN(textTypeLimit)) textTypeLimit = null;
        i++;
      }
    }

    // 加载或创建状态文件
    const state = await loadState();
    console.log(`状态文件加载完成，上次更新: ${state.lastUpdated}`);

    // 扫描assert目录下的所有行业
    const industryBaseDir = path.join(__dirname, 'assert');
    const industries = await fs.readdir(industryBaseDir, { withFileTypes: true });

    // 过滤出子目录（行业目录）
    let industryDirs = industries
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    // 如果指定了特定行业，只处理该行业
    if (targetIndustry) {
      industryDirs = industryDirs.filter(industry => industry === targetIndustry);
      if (industryDirs.length === 0) {
        console.log(`未找到指定的行业：${targetIndustry}`);
        return;
      }
    }

    console.log(`发现 ${industryDirs.length} 个行业目录${targetIndustry ? ` (已过滤为 ${targetIndustry})` : ''}`);

    const results = [];

    // 处理每个行业
    for (const industry of industryDirs) {
      const configPath = path.join(industryBaseDir, industry, 'config.json');

      // 检查配置文件是否存在
      if (await fileExists(configPath)) {
        // 如果设置了文本类型限制，传递给processIndustry函数
        const result = await processIndustry(industry, configPath, state, textTypeLimit);
        results.push(result);
      } else {
        console.log(`${industry} 行业缺少配置文件，跳过`);
        results.push({
          industry,
          success: false,
          error: '缺少配置文件'
        });
      }
    }

    // 生成所有行业创业方案摘要
    await generateSummary(results);

    console.log('\n======== 文本创业点子生成完成 ========');
    console.log(`成功处理行业数: ${results.filter(r => r.success).length}`);
    console.log(`失败行业数: ${results.filter(r => !r.success).length}`);
    console.log(`跳过行业数: ${results.filter(r => r.skipped).length}`);
  } catch (error) {
    console.error('程序执行错误:', error);
  }
}

// 处理单个行业
async function processIndustry(industry, configPath, state, textTypeLimit = null) {
  console.log(`\n********** 开始处理 ${industry} 行业的文本创业点子 **********`);

  try {
    // 检查是否已经完全处理过该行业
    const industryState = state.processedIndustries[industry] || {};

    if (industryState.textCompleted && !textTypeLimit) {
      console.log(`${industry} 行业已完全处理，跳过`);
      return {
        industry,
        success: true,
        skipped: true,
        message: '已完全处理'
      };
    }

    // 读取行业配置
    const configData = await fs.readFile(configPath, 'utf8');
    const configItems = JSON.parse(configData);

    // 提取文本类型（没有visual标记的即为文本类型）
    let textTypes = configItems.filter(item => !item.visual);

    if (textTypes.length === 0) {
      console.log(`${industry} 行业没有定义文本类型，跳过`);
      industryState.textCompleted = true;
      state.processedIndustries[industry] = industryState;
      await saveState(state);

      return {
        industry,
        success: true,
        skipped: true,
        message: '没有定义文本类型'
      };
    }

    // 如果设置了限制，只处理指定数量的文本类型
    if (textTypeLimit && textTypeLimit > 0) {
      textTypes = textTypes.slice(0, textTypeLimit);
      console.log(`由于设置了限制，只处理 ${textTypeLimit} 个文本类型`);
    }

    console.log(`发现 ${textTypes.length} 个文本类型`);

    // 分析所有文本类型的创业点子
    const allIdeas = await analyzeIndustryIdeas(industry, textTypes, state);

    // 选择最佳创业点子
    const bestIdeas = await selectBestIdeas(industry, allIdeas, state);

    // 合并最佳创业点子
    const mergedIdea = await combineIndustryTopIdeas(industry, bestIdeas);

    // 更新状态（如果没有限制）
    if (!textTypeLimit) {
      industryState.textCompleted = true;
      state.processedIndustries[industry] = industryState;
      await saveState(state);
    }

    return {
      industry,
      success: true,
      textTypeCount: textTypes.length,
      ideasGenerated: allIdeas.length,
      bestIdeasSelected: bestIdeas.length,
      merged: !!mergedIdea
    };
  } catch (error) {
    console.error(`处理 ${industry} 行业失败:`, error.message);
    return {
      industry,
      success: false,
      error: error.message
    };
  }
}

// 生成所有行业创业方案摘要
async function generateSummary(results) {
  console.log('\n==== 生成文本创业方案摘要 ====');

  try {
    const outputDir = await ensureTextOutputDir();
    const summaryLines = [`# 基于文本数据的行业创业方案摘要\n`];

    for (const result of results) {
      if (!result.success || result.skipped) continue;

      const industry = result.industry;
      const mergedFilePath = await findMergedIdeaFile(industry);

      if (!mergedFilePath) {
        summaryLines.push(`## ${industry}\n`);
        summaryLines.push(`*未生成合并创业方案*\n`);
        continue;
      }

      const content = await fs.readFile(mergedFilePath, 'utf8');
      const summary = extractSummary(content);

      summaryLines.push(`## ${industry}\n`);
      summaryLines.push(summary ? summary : '*未找到摘要*');
      summaryLines.push('\n');
    }

    const summaryContent = summaryLines.join('\n');
    const summaryPath = path.join(outputDir, '00-文本创业方案摘要.md');
    await fs.writeFile(summaryPath, summaryContent, 'utf8');
    console.log(`创业方案摘要已保存到: ${summaryPath}`);

    return summaryPath;
  } catch (error) {
    console.error('生成摘要失败:', error.message);
    return null;
  }
}

// 执行主函数
main();
