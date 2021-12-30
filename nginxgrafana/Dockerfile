FROM grafana/grafana
EXPOSE 8080 80
USER root
COPY start-nginx-grafana.sh /start-nginx-grafana.sh
RUN apk update && apk add nginx
RUN chmod +x /start-nginx-grafana.sh
COPY ./grafana.ini /etc/grafana/grafana.ini 
COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./conf.d/grafana.conf /etc/nginx/conf.d/grafana.conf
ENTRYPOINT [ "/start-nginx-grafana.sh" ]