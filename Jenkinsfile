pipeline {
  agent any
  stages {
    stage('Verify') {
      steps {
        sh '''set -e
npm ci
npm run type-check
npm run build
'''
      }
    }
    stage('Docker build') {
      steps {
        sh 'docker build -t glucopilot-admin:${BUILD_NUMBER} .'
      }
    }
  }
}
