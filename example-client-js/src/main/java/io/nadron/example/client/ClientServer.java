package io.nadron.example.client;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

/**
 * Author     : zh_zhou@Ctrip.com
 * Copyright  : Ctrip Copyright (c) 2017
 * Company    : Ctrip
 * Create at  : 2017/9/15 18:15
 * Description:
 */
@ComponentScan(basePackages = {"io.nadron.example.client"})
@SpringBootApplication
@EnableAutoConfiguration
@SpringBootConfiguration
public class ClientServer {

    public static void main(String[] args) {
        SpringApplication.run(ClientServer.class, args);
    }
}
