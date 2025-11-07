# Docker 是什么？

## Docker 简介

**Docker** 是一个开源的容器化平台，可以将应用程序及其依赖项打包到一个轻量级、可移植的容器中。

### 简单类比
- **传统方式**：就像在不同电脑上安装软件，每台电脑环境不同，可能出现"在我电脑上能运行"的问题
- **Docker方式**：就像把软件和运行环境装在一个"集装箱"里，在任何支持Docker的电脑上都能运行，环境完全一致

### Docker 的核心概念

1. **镜像（Image）**：像软件的"安装包"，包含了运行应用所需的一切
2. **容器（Container）**：镜像运行后的实例，就像被启动的程序
3. **Docker Compose**：用配置文件管理多个容器的工具

### 为什么使用 Docker？

✅ **环境一致性**：开发、测试、生产环境完全一致  
✅ **快速部署**：一次打包，到处运行  
✅ **资源隔离**：每个应用运行在独立环境中  
✅ **易于管理**：启动、停止、删除都很简单  

---

## 部署 Stirling-PDF

### 前置要求

1. **安装 Docker Desktop**（Windows）
   - 下载地址：https://www.docker.com/products/docker-desktop/
   - 安装后重启电脑

2. **验证安装**
   ```bash
   docker --version
   docker-compose --version
   ```

### 部署步骤

1. **进入项目目录**
   ```bash
   cd C:\Users\ALEXGREENO\myprojects\Stirling-PDF
   ```

2. **使用 Docker Compose 启动**
   ```bash
   docker-compose up -d
   ```
   - `-d` 参数表示后台运行

3. **访问应用**
   - 打开浏览器访问：http://localhost:8080

4. **查看运行状态**
   ```bash
   docker ps
   ```

5. **停止服务**
   ```bash
   docker-compose down
   ```

6. **查看日志**
   ```bash
   docker-compose logs -f
   ```

### 常用 Docker 命令

```bash
# 查看运行的容器
docker ps

# 查看所有容器（包括停止的）
docker ps -a

# 停止容器
docker stop <容器名或ID>

# 启动容器
docker start <容器名或ID>

# 删除容器
docker rm <容器名或ID>

# 查看镜像
docker images

# 删除镜像
docker rmi <镜像名或ID>

# 查看日志
docker logs <容器名或ID>

# 进入容器内部
docker exec -it <容器名或ID> /bin/sh
```

